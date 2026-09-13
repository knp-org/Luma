//! A single continuous source performs transitions on the audio callback, not a UI timer.
use crate::{settings::AudioSettings, spectrum::SpectrumTap};
use lofty::{prelude::*, tag::ItemKey};
use rodio::{source::UniformSourceIterator, Decoder, Source};
use serde::Serialize;
use std::{
    fs::File,
    sync::{Arc, Mutex},
    time::Duration,
};

const RATE: u32 = 48_000;
const CHANNELS: u16 = 2;
#[derive(Clone, Debug, Default, Serialize)]
pub struct PlaybackStatus {
    pub path: Option<String>,
    pub generation: u64,
    pub position_secs: f64,
    pub finished: bool,
    pub paused: bool,
    pub error: Option<String>,
}
pub type SharedStatus = Arc<Mutex<PlaybackStatus>>;
pub type NextTrack = Arc<Mutex<Option<PreparedTrack>>>;

pub struct PreparedTrack {
    pub path: String,
    pub generation: u64,
    pub source: Box<dyn Source<Item = f32> + Send>,
    pub position: u64,
    pub duration: Option<u64>,
    gain: f32,
    low: [f32; 2],
    high_low: [f32; 2],
}
impl PreparedTrack {
    pub fn open(path: String, generation: u64, seconds: f64) -> Result<Self, String> {
        let file = File::open(&path).map_err(|e| format!("Cannot open {}: {}", path, e))?;
        let mut decoder =
            Decoder::try_from(file).map_err(|e| format!("Cannot decode {}: {}", path, e))?;
        let duration = decoder.total_duration();
        let seek = Duration::from_secs_f64(seconds.max(0.0));
        // Always build a replacement before swapping the current sink. Preserve the timeline
        // explicitly; skip_duration starts its own clock at zero.
        let source: Box<dyn Source<Item = f32> + Send> =
            if seconds > 0.0 && decoder.try_seek(seek).is_err() {
                let fresh = Decoder::try_from(File::open(&path).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
                Box::new(fresh.skip_duration(seek))
            } else {
                Box::new(decoder)
            };
        let mut gain = 1.0;
        if let Ok(file) = lofty::read_from_path(&path) {
            if let Some(tag) = file.primary_tag().or_else(|| file.first_tag()) {
                let db = tag
                    .get_string(&ItemKey::ReplayGainTrackGain)
                    .and_then(|s| s.split_whitespace().next())
                    .and_then(|s| s.parse::<f32>().ok());
                let peak = tag
                    .get_string(&ItemKey::ReplayGainTrackPeak)
                    .and_then(|s| s.parse::<f32>().ok());
                gain = replay_gain(db, peak);
            }
        }
        Ok(Self {
            path,
            generation,
            source: Box::new(UniformSourceIterator::new(source, CHANNELS, RATE)),
            position: (seconds * RATE as f64 * CHANNELS as f64) as u64,
            duration: duration.map(|d| (d.as_secs_f64() * RATE as f64 * CHANNELS as f64) as u64),
            gain,
            low: [0.0; 2],
            high_low: [0.0; 2],
        })
    }
    fn sample(&mut self, effects: &Effects) -> Option<f32> {
        let input = self.source.next()?;
        let channel = (self.position % 2) as usize;
        self.position += 1;
        // Complementary one-pole bands sum to the original signal at neutral EQ.
        self.low[channel] += effects.low_alpha * (input - self.low[channel]);
        self.high_low[channel] += effects.high_alpha * (input - self.high_low[channel]);
        let low = self.low[channel];
        let mid = self.high_low[channel] - low;
        let high = input - self.high_low[channel];
        let result = low * effects.gains[0] + mid * effects.gains[1] + high * effects.gains[2];
        Some(result * if effects.replay_gain { self.gain } else { 1.0 })
    }
}
pub fn replay_gain(db: Option<f32>, peak: Option<f32>) -> f32 {
    let mut gain = db
        .filter(|v| v.is_finite())
        .map(|v| 10.0_f32.powf(v.clamp(-30.0, 20.0) / 20.0))
        .unwrap_or(1.0);
    if let Some(peak) = peak.filter(|v| v.is_finite() && *v > 0.0) {
        gain = gain.min(1.0 / peak);
    }
    gain
}

struct Effects {
    low_alpha: f32,
    high_alpha: f32,
    gains: [f32; 3],
    replay_gain: bool,
}
impl From<&AudioSettings> for Effects {
    fn from(settings: &AudioSettings) -> Self {
        let headroom = settings
            .eq_low
            .max(settings.eq_mid)
            .max(settings.eq_high)
            .max(0.0);
        Self {
            low_alpha: 1.0 - (-2.0 * std::f32::consts::PI * 250.0 / RATE as f32).exp(),
            high_alpha: 1.0 - (-2.0 * std::f32::consts::PI * 4000.0 / RATE as f32).exp(),
            gains: [settings.eq_low, settings.eq_mid, settings.eq_high]
                .map(|db| 10.0_f32.powf((db - headroom) / 20.0)),
            replay_gain: settings.replay_gain,
        }
    }
}

pub struct PlaybackSource {
    current: PreparedTrack,
    next: NextTrack,
    outgoing: Option<(PreparedTrack, u64, u64)>,
    status: SharedStatus,
    settings: Arc<Mutex<AudioSettings>>,
    effects: AudioSettings,
    coefficients: Effects,
    tick: u32,
    fade_retry: u32,
    fade_samples: u64,
    spectrum: Option<SpectrumTap>,
}
impl PlaybackSource {
    pub fn new(
        current: PreparedTrack,
        next: NextTrack,
        status: SharedStatus,
        settings: Arc<Mutex<AudioSettings>>,
    ) -> Self {
        let effects = settings.lock().unwrap().clone();
        let coefficients = Effects::from(&effects);
        let fade_samples = (effects.crossfade_seconds * RATE as f32 * CHANNELS as f32) as u64;
        let source = Self {
            current,
            next,
            outgoing: None,
            status,
            settings,
            effects,
            coefficients,
            tick: 0,
            fade_retry: 0,
            fade_samples,
            spectrum: None,
        };
        source.publish(false);
        source
    }
    pub fn with_spectrum(mut self, tap: SpectrumTap) -> Self {
        self.spectrum = Some(tap);
        self
    }
    fn publish(&self, finished: bool) {
        let mut state = self.status.lock().unwrap();
        if state.generation > self.current.generation {
            return;
        }
        if state.path.as_deref() != Some(&self.current.path) {
            state.path = Some(self.current.path.clone());
        }
        state.generation = self.current.generation;
        state.position_secs = self.current.position as f64 / (RATE as f64 * CHANNELS as f64);
        state.finished = finished;
    }
    fn advance(&mut self, fade: u64) -> bool {
        let upcoming = if fade > 0 {
            // A busy preload must never stall an in-progress crossfade probe.
            self.next.try_lock().ok().and_then(|mut next| next.take())
        } else {
            self.next.lock().unwrap().take()
        };
        if let Some(track) = upcoming {
            let old = std::mem::replace(&mut self.current, track);
            self.outgoing = if fade > 0 { Some((old, 0, fade)) } else { None };
            self.fade_retry = 0;
            self.publish(false);
            true
        } else {
            false
        }
    }
}
impl Iterator for PlaybackSource {
    type Item = f32;
    fn next(&mut self) -> Option<f32> {
        if self.tick.is_multiple_of(1024) {
            if let Ok(settings) = self.settings.try_lock() {
                if *settings != self.effects {
                    self.effects = settings.clone();
                    self.coefficients = Effects::from(&self.effects);
                    self.fade_samples =
                        (self.effects.crossfade_seconds * RATE as f32 * CHANNELS as f32) as u64;
                    self.fade_retry = 0;
                }
            }
            self.publish(false);
        }
        self.tick = self.tick.wrapping_add(1);
        let fade = self.fade_samples;
        self.fade_retry = self.fade_retry.saturating_sub(1);
        if fade > 0 && self.outgoing.is_none() {
            if let Some(duration) = self.current.duration {
                let remaining = duration.saturating_sub(self.current.position);
                if remaining > 0 && remaining <= fade && self.fade_retry == 0 {
                    if !self.advance(remaining) {
                        // Retry a late preload about every 10ms, not for every sample.
                        self.fade_retry = 1024;
                    }
                }
            }
        }
        let sample = match self.current.sample(&self.coefficients) {
            Some(sample) => sample,
            None => if (self.effects.gapless || fade > 0) && self.advance(0) {
                self.current.sample(&self.coefficients)
            } else {
                None
            }
            .or_else(|| {
                self.publish(true);
                None
            })?,
        };
        let mut output = sample;
        if let Some((outgoing, elapsed, duration)) = &mut self.outgoing {
            let amount = *elapsed as f32 / *duration as f32;
            output = sample * amount
                + outgoing.sample(&self.coefficients).unwrap_or(0.0) * (1.0 - amount);
            *elapsed += 1;
            if *elapsed >= *duration {
                self.outgoing = None;
            }
        }
        let output = output.clamp(-1.0, 1.0);
        if let Some(tap) = &mut self.spectrum {
            tap.push(output, self.current.generation);
        }
        Some(output)
    }
}
impl Source for PlaybackSource {
    fn current_span_len(&self) -> Option<usize> {
        None
    }
    fn channels(&self) -> u16 {
        CHANNELS
    }
    fn sample_rate(&self) -> u32 {
        RATE
    }
    fn total_duration(&self) -> Option<Duration> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn track(id: u64, values: Vec<f32>) -> PreparedTrack {
        let len = values.len() as u64;
        PreparedTrack {
            path: id.to_string(),
            generation: id,
            source: Box::new(rodio::buffer::SamplesBuffer::new(2, RATE, values)),
            position: 0,
            duration: Some(len),
            gain: 1.0,
            low: [0.0; 2],
            high_low: [0.0; 2],
        }
    }
    #[test]
    fn gapless_has_no_silence_and_updates_track_identity() {
        let status = Arc::new(Mutex::new(PlaybackStatus::default()));
        let next = Arc::new(Mutex::new(Some(track(2, vec![0.5; 4]))));
        let mut source = PlaybackSource::new(
            track(1, vec![0.25; 4]),
            next,
            status.clone(),
            Arc::new(Mutex::new(AudioSettings::default())),
        );
        let samples: Vec<_> = source.by_ref().collect();
        assert_eq!(samples.len(), 8);
        for (i, sample) in samples.iter().enumerate() {
            assert!((*sample - if i < 4 { 0.25 } else { 0.5 }).abs() < 0.00001);
        }
        assert_eq!(status.lock().unwrap().generation, 2);
        assert!(status.lock().unwrap().finished);
    }
    #[test]
    fn crossfade_overlaps_sources_without_extra_samples() {
        let settings = AudioSettings {
            crossfade_seconds: 4.0 / 96_000.0,
            ..Default::default()
        };
        let mut source = PlaybackSource::new(
            track(1, vec![0.2; 8]),
            Arc::new(Mutex::new(Some(track(2, vec![0.6; 8])))),
            Arc::new(Mutex::new(PlaybackStatus::default())),
            Arc::new(Mutex::new(settings)),
        );
        let samples: Vec<_> = source.by_ref().collect();
        assert_eq!(samples.len(), 12);
        assert!((samples[4] - 0.2).abs() < 0.00001);
        assert!((samples[6] - 0.4).abs() < 0.00001);
    }
    #[test]
    fn busy_settings_and_preload_do_not_block_samples_and_late_preload_is_retried() {
        let settings = Arc::new(Mutex::new(AudioSettings {
            crossfade_seconds: 1.0,
            ..Default::default()
        }));
        let upcoming = Arc::new(Mutex::new(Some(track(2, vec![0.6; 20_000]))));
        let status = Arc::new(Mutex::new(PlaybackStatus::default()));
        let mut source = PlaybackSource::new(
            track(1, vec![0.2; 10_000]),
            upcoming.clone(),
            status.clone(),
            settings.clone(),
        );
        let settings_guard = settings.lock().unwrap();
        let preload_guard = upcoming.lock().unwrap();
        for _ in 0..64 {
            assert!(source.next().is_some());
        }
        assert_eq!(status.lock().unwrap().generation, 1);
        drop(settings_guard);
        drop(preload_guard);
        for _ in 0..1024 {
            assert!(source.next().is_some());
        }
        assert_eq!(status.lock().unwrap().generation, 2);
        settings.lock().unwrap().eq_low = -6.0;
        for _ in 0..1024 {
            assert!(source.next().is_some());
        }
        assert_eq!(source.effects.eq_low, -6.0);
    }

    #[test]
    fn replay_gain_limits_peak_and_ignores_invalid_tags() {
        assert!((replay_gain(Some(6.0), Some(1.0)) - 1.0).abs() < 0.001);
        assert_eq!(replay_gain(Some(f32::NAN), None), 1.0);
    }
}
