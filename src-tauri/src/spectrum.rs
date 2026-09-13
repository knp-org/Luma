//! Audio samples cross a bounded channel; FFT work never runs on the audio callback.
use crate::audio_source::PlaybackStatus;
use rustfft::{num_complex::Complex32, Fft, FftPlanner};
use serde::Serialize;
use std::{
    sync::{
        atomic::{AtomicU32, AtomicU64, Ordering},
        mpsc::{self, SyncSender},
        Arc, Mutex,
    },
    thread,
    time::Instant,
};

pub const BANDS: usize = 48;
const FRAMES: usize = 2048;
const SAMPLES: usize = FRAMES * 2;
const RATE: f32 = 48_000.0;

struct AudioBlock {
    samples: [f32; SAMPLES],
    generation: u64,
}
#[derive(Clone, Serialize)]
pub struct SpectrumFrame {
    pub levels: Vec<f32>,
    pub generation: u64,
}
impl Default for SpectrumFrame {
    fn default() -> Self {
        Self {
            levels: vec![0.0; BANDS],
            generation: 0,
        }
    }
}
pub struct SpectrumAnalyzer {
    sender: SyncSender<AudioBlock>,
    latest: Arc<Mutex<(SpectrumFrame, Instant)>>,
    clock: Instant,
    requested_until: AtomicU64,
    volume: Arc<AtomicU32>,
}
impl SpectrumAnalyzer {
    pub fn new() -> Arc<Self> {
        let (sender, receiver) = mpsc::sync_channel::<AudioBlock>(1);
        let latest = Arc::new(Mutex::new((SpectrumFrame::default(), Instant::now())));
        let volume = Arc::new(AtomicU32::new(0.5f32.to_bits()));
        let output = latest.clone();
        let gain = volume.clone();
        thread::spawn(move || {
            let mut processor = SpectrumProcessor::new();
            while let Ok(block) = receiver.recv() {
                let volume = f32::from_bits(gain.load(Ordering::Relaxed));
                let levels = processor.analyze(&block.samples, volume);
                let mut frame = output.lock().unwrap();
                if block.generation >= frame.0.generation {
                    *frame = (
                        SpectrumFrame {
                            levels,
                            generation: block.generation,
                        },
                        Instant::now(),
                    );
                }
            }
        });
        Arc::new(Self {
            sender,
            latest,
            volume,
            clock: Instant::now(),
            requested_until: AtomicU64::new(0),
        })
    }
    fn wanted(&self) -> bool {
        self.clock.elapsed().as_millis() < self.requested_until.load(Ordering::Relaxed) as u128
    }
    pub fn set_volume(&self, volume: f32) {
        self.volume.store(volume.to_bits(), Ordering::Relaxed);
    }
    pub fn frame(&self, status: &PlaybackStatus) -> SpectrumFrame {
        self.requested_until.store(
            self.clock.elapsed().as_millis() as u64 + 1500,
            Ordering::Relaxed,
        );
        let latest = self.latest.lock().unwrap();
        if status.paused
            || status.finished
            || self.volume.load(Ordering::Relaxed) == 0.0f32.to_bits()
            || latest.0.generation != status.generation
            || latest.1.elapsed().as_millis() > 300
        {
            SpectrumFrame {
                generation: status.generation,
                ..Default::default()
            }
        } else {
            latest.0.clone()
        }
    }
}

pub struct SpectrumTap {
    analyzer: Arc<SpectrumAnalyzer>,
    samples: [f32; SAMPLES],
    filled: usize,
    tick: usize,
    enabled: bool,
    generation: u64,
}
impl SpectrumTap {
    pub fn new(analyzer: Arc<SpectrumAnalyzer>) -> Self {
        Self {
            analyzer,
            samples: [0.0; SAMPLES],
            filled: 0,
            tick: 0,
            enabled: false,
            generation: 0,
        }
    }
    pub fn push(&mut self, sample: f32, generation: u64) {
        if self.tick == 0 {
            self.enabled = self.analyzer.wanted();
            if !self.enabled {
                self.filled = 0;
            }
        }
        self.tick = (self.tick + 1) % SAMPLES;
        if !self.enabled {
            return;
        }
        if generation != self.generation {
            self.filled = 0;
            self.generation = generation;
        }
        self.samples[self.filled] = if sample.is_finite() { sample } else { 0.0 };
        self.filled += 1;
        if self.filled == SAMPLES {
            // Dropping a visual frame is preferable to ever delaying sound.
            let _ = self.analyzer.sender.try_send(AudioBlock {
                samples: self.samples,
                generation,
            });
            self.filled = 0;
        }
    }
}

struct SpectrumProcessor {
    fft: Arc<dyn Fft<f32>>,
    window: Vec<f32>,
    bins: [(usize, usize); BANDS],
    left: Vec<Complex32>,
    right: Vec<Complex32>,
    scratch: Vec<Complex32>,
}
impl SpectrumProcessor {
    fn new() -> Self {
        let fft = FftPlanner::new().plan_fft_forward(FRAMES);
        let scratch = vec![Complex32::default(); fft.get_inplace_scratch_len()];
        Self {
            fft,
            scratch,
            bins: std::array::from_fn(|band| {
                let low = 40.0 * 400.0f32.powf(band as f32 / BANDS as f32);
                let high = 40.0 * 400.0f32.powf((band + 1) as f32 / BANDS as f32);
                let start = ((low * FRAMES as f32 / RATE).round() as usize).max(1);
                let end = ((high * FRAMES as f32 / RATE).round() as usize)
                    .max(start + 1)
                    .min(FRAMES / 2);
                (start, end)
            }),
            window: (0..FRAMES)
                .map(|i| 0.5 - 0.5 * (std::f32::consts::TAU * i as f32 / FRAMES as f32).cos())
                .collect(),
            left: vec![Complex32::default(); FRAMES],
            right: vec![Complex32::default(); FRAMES],
        }
    }
    fn analyze(&mut self, samples: &[f32; SAMPLES], volume: f32) -> Vec<f32> {
        for i in 0..FRAMES {
            self.left[i] = Complex32::new(samples[i * 2] * self.window[i], 0.0);
            self.right[i] = Complex32::new(samples[i * 2 + 1] * self.window[i], 0.0);
        }
        self.fft
            .process_with_scratch(&mut self.left, &mut self.scratch);
        self.fft
            .process_with_scratch(&mut self.right, &mut self.scratch);
        self.bins
            .iter()
            .map(|&(start, end)| {
                // Combine channel power, so opposite-phase stereo never cancels out.
                let power = (start..end)
                    .map(|bin| (self.left[bin].norm_sqr() + self.right[bin].norm_sqr()) * 0.5)
                    .fold(0.0, f32::max);
                let amplitude = power.sqrt() * 4.0 / FRAMES as f32 * volume;
                if amplitude <= 0.0001 {
                    0.0
                } else {
                    ((20.0 * amplitude.log10() + 70.0) / 70.0).clamp(0.0, 1.0)
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn tone(hz: f32, antiphase: bool) -> [f32; SAMPLES] {
        std::array::from_fn(|i| {
            (std::f32::consts::TAU * hz * (i / 2) as f32 / RATE).sin()
                * 0.5
                * if antiphase && i % 2 == 1 { -1.0 } else { 1.0 }
        })
    }
    #[test]
    fn silence_and_mute_produce_no_energy() {
        let mut processor = SpectrumProcessor::new();
        assert!(processor
            .analyze(&[0.0; SAMPLES], 1.0)
            .iter()
            .all(|v| *v == 0.0));
        assert!(processor
            .analyze(&tone(1000.0, false), 0.0)
            .iter()
            .all(|v| *v == 0.0));
    }
    #[test]
    fn tones_land_in_their_logarithmic_frequency_band() {
        let mut processor = SpectrumProcessor::new();
        for hz in [100.0f32, 1000.0, 8000.0] {
            let levels = processor.analyze(&tone(hz, false), 1.0);
            let peak = levels
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.total_cmp(b.1))
                .unwrap()
                .0;
            let expected = ((hz / 40.0).ln() / 400.0f32.ln() * BANDS as f32) as usize;
            assert!(
                peak.abs_diff(expected) <= 2,
                "{hz}: peak {peak}, expected {expected}"
            );
            assert!(levels[peak] > 0.8);
            assert!(levels
                .iter()
                .all(|v| v.is_finite() && (0.0..=1.0).contains(v)));
        }
    }
    #[test]
    fn antiphase_stereo_retains_its_spectrum() {
        let mut processor = SpectrumProcessor::new();
        assert_eq!(
            processor.analyze(&tone(1000.0, false), 1.0),
            processor.analyze(&tone(1000.0, true), 1.0)
        );
    }
    #[test]
    fn paused_or_obsolete_frames_are_not_displayed() {
        let analyzer = SpectrumAnalyzer::new();
        *analyzer.latest.lock().unwrap() = (
            SpectrumFrame {
                levels: vec![1.0; BANDS],
                generation: 3,
            },
            Instant::now(),
        );
        let mut status = PlaybackStatus {
            generation: 3,
            ..Default::default()
        };
        assert_eq!(analyzer.frame(&status).levels[0], 1.0);
        status.paused = true;
        assert!(analyzer.frame(&status).levels.iter().all(|v| *v == 0.0));
        status.paused = false;
        status.generation = 4;
        assert!(analyzer.frame(&status).levels.iter().all(|v| *v == 0.0));
    }
}
