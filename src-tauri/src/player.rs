pub use crate::audio_source::PlaybackStatus;
use crate::{
    audio_source::{NextTrack, PlaybackSource, PreparedTrack, SharedStatus},
    settings::AudioSettings,
    spectrum::{SpectrumAnalyzer, SpectrumFrame, SpectrumTap},
};
use rodio::{OutputStream, OutputStreamBuilder, Sink};
use std::{
    sync::{mpsc, Arc, Mutex},
    thread,
};

enum AudioCommand {
    Play(String, f64, bool),
    Toggle,
    Stop,
    Seek(f64),
    Volume(f32),
    Preload(Option<String>, u64),
    Effects(AudioSettings),
}
type Reply = mpsc::Sender<Result<PlaybackStatus, String>>;
pub struct AudioPlayer {
    sender: mpsc::Sender<(AudioCommand, Reply)>,
    shared: SharedStatus,
    spectrum: Arc<SpectrumAnalyzer>,
}
struct Worker {
    stream: Option<OutputStream>,
    sink: Option<Sink>,
    shared: SharedStatus,
    spectrum: Arc<SpectrumAnalyzer>,
    next: NextTrack,
    effects: Arc<Mutex<AudioSettings>>,
    volume: f32,
    serial: u64,
}
impl Worker {
    fn replace(
        &mut self,
        path: String,
        seconds: f64,
        paused: bool,
        keep_generation: bool,
    ) -> Result<(), String> {
        if self.stream.is_none() {
            self.stream = Some(
                OutputStreamBuilder::open_default_stream()
                    .map_err(|e| format!("Audio device unavailable: {}", e))?,
            );
        }
        let generation = if keep_generation {
            self.shared.lock().unwrap().generation
        } else {
            self.serial += 1;
            self.serial
        };
        let track = PreparedTrack::open(path, generation, seconds)?;
        let sink = Sink::connect_new(self.stream.as_ref().unwrap().mixer());
        sink.set_volume(self.volume);
        // New tracks start paused until the old sink has stopped, avoiding overlap.
        sink.pause();
        let upcoming = Arc::new(Mutex::new(None));
        if let Some(old) = self.sink.take() {
            old.stop();
        }
        self.next = upcoming.clone();
        {
            let mut state = self.shared.lock().unwrap();
            state.paused = paused;
            state.error = None;
        }
        sink.append(
            PlaybackSource::new(track, upcoming, self.shared.clone(), self.effects.clone())
                .with_spectrum(SpectrumTap::new(self.spectrum.clone())),
        );
        if !paused {
            sink.play();
        }
        self.sink = Some(sink);
        Ok(())
    }
    fn command(&mut self, command: AudioCommand) -> Result<(), String> {
        match command {
            AudioCommand::Play(path, seconds, paused) => self.replace(path, seconds, paused, false),
            AudioCommand::Seek(seconds) => {
                let status = self.shared.lock().unwrap().clone();
                let path = status.path.ok_or("No track loaded")?;
                self.replace(path, seconds, status.paused, false)
            }
            AudioCommand::Toggle => {
                let sink = self.sink.as_ref().ok_or("No track loaded")?;
                if self.shared.lock().unwrap().finished {
                    return Err("Track finished; select a track to play".into());
                }
                let paused = !sink.is_paused();
                if paused {
                    sink.pause();
                } else {
                    sink.play();
                }
                self.shared.lock().unwrap().paused = paused;
                Ok(())
            }
            AudioCommand::Stop => {
                if let Some(sink) = self.sink.take() {
                    sink.stop();
                }
                *self.next.lock().unwrap() = None;
                let mut state = self.shared.lock().unwrap();
                state.finished = true;
                state.paused = true;
                Ok(())
            }
            AudioCommand::Volume(volume) => {
                if !volume.is_finite() {
                    return Err("Volume must be finite".into());
                }
                self.volume = volume.clamp(0.0, 1.0);
                self.spectrum.set_volume(self.volume);
                if let Some(sink) = &self.sink {
                    sink.set_volume(self.volume);
                }
                Ok(())
            }
            AudioCommand::Preload(path, generation) => {
                // Do not apply an obsolete UI request after a transition.
                if self.shared.lock().unwrap().generation != generation {
                    return Ok(());
                }
                *self.next.lock().unwrap() = None;
                let prepared = if let Some(path) = path {
                    self.serial += 1;
                    Some(PreparedTrack::open(path, self.serial, 0.0)?)
                } else {
                    None
                };
                // Lock order matches the source: next, then status.
                let mut next = self.next.lock().unwrap();
                if self.shared.lock().unwrap().generation == generation {
                    *next = prepared;
                }
                Ok(())
            }
            AudioCommand::Effects(settings) => {
                settings.validate()?;
                *self.effects.lock().unwrap() = settings;
                Ok(())
            }
        }
    }
}
impl AudioPlayer {
    pub fn new() -> Self {
        let (sender, receiver) = mpsc::channel::<(AudioCommand, Reply)>();
        let shared = Arc::new(Mutex::new(PlaybackStatus {
            finished: true,
            paused: true,
            ..Default::default()
        }));
        let status = shared.clone();
        let spectrum = SpectrumAnalyzer::new();
        let analyzer = spectrum.clone();
        thread::spawn(move || {
            let settings = crate::settings::load_settings().unwrap_or_default().audio;
            let mut worker = Worker {
                stream: None,
                sink: None,
                shared: status,
                spectrum: analyzer,
                next: Arc::new(Mutex::new(None)),
                effects: Arc::new(Mutex::new(settings)),
                volume: 0.5,
                serial: 0,
            };
            while let Ok((command, reply)) = receiver.recv() {
                let result = worker
                    .command(command)
                    .map(|_| worker.shared.lock().unwrap().clone());
                let _ = reply.send(result);
            }
        });
        Self {
            sender,
            shared,
            spectrum,
        }
    }
    fn request(&self, command: AudioCommand) -> Result<PlaybackStatus, String> {
        let (tx, rx) = mpsc::channel();
        self.sender
            .send((command, tx))
            .map_err(|_| "Audio worker unavailable".to_string())?;
        rx.recv().map_err(|_| "Audio worker stopped".to_string())?
    }
    pub fn spectrum(&self) -> SpectrumFrame {
        self.spectrum.frame(&self.get_status())
    }
    pub fn get_status(&self) -> PlaybackStatus {
        self.shared.lock().unwrap().clone()
    }
    pub fn play(&self, path: String, seconds: f64, paused: bool) -> Result<PlaybackStatus, String> {
        if !seconds.is_finite() || !(0.0..=31_536_000.0).contains(&seconds) {
            return Err("Invalid playback position".into());
        }
        self.request(AudioCommand::Play(path, seconds, paused))
    }
    pub fn pause_toggle(&self) -> Result<PlaybackStatus, String> {
        self.request(AudioCommand::Toggle)
    }
    pub fn stop(&self) -> Result<PlaybackStatus, String> {
        self.request(AudioCommand::Stop)
    }
    pub fn seek(&self, seconds: f64) -> Result<PlaybackStatus, String> {
        if !seconds.is_finite() || !(0.0..=31_536_000.0).contains(&seconds) {
            return Err("Invalid seek position".into());
        }
        self.request(AudioCommand::Seek(seconds))
    }
    pub fn set_volume(&self, volume: f32) -> Result<PlaybackStatus, String> {
        self.request(AudioCommand::Volume(volume))
    }
    pub fn preload(&self, path: Option<String>, generation: u64) -> Result<PlaybackStatus, String> {
        self.request(AudioCommand::Preload(path, generation))
    }
    pub fn set_effects(&self, settings: AudioSettings) -> Result<PlaybackStatus, String> {
        self.request(AudioCommand::Effects(settings))
    }
}

impl Default for AudioPlayer {
    fn default() -> Self {
        Self::new()
    }
}
