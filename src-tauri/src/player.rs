use std::thread;
use std::sync::{mpsc, Arc, Mutex};
use std::fs::File;
use std::io::BufReader;
use std::time::Duration;
use rodio::{Decoder, Source, OutputStreamBuilder, Sink};
use serde::Serialize;

pub enum AudioCommand {
    Play(String),
    Toggle,
    Stop,
    Seek(u64),
    SetVolume(f32),
}

/// Shared state that the audio thread updates and the main thread reads.
struct SharedSinkState {
    sink: Sink,
}

#[derive(Serialize, Clone)]
pub struct PlaybackStatus {
    pub position_secs: f64,
    pub finished: bool,
}

pub struct AudioPlayer {
    sender: Mutex<mpsc::Sender<AudioCommand>>,
    shared: Arc<Mutex<Option<SharedSinkState>>>,
}

impl AudioPlayer {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        let shared: Arc<Mutex<Option<SharedSinkState>>> = Arc::new(Mutex::new(None));
        let shared_clone = shared.clone();

        // Spawn audio thread
        thread::spawn(move || {
            // Create output stream using rodio 0.21 API
            let stream = OutputStreamBuilder::open_default_stream()
                .expect("Failed to open default audio stream");
            let mixer = stream.mixer();

            let mut current_path: Option<String> = None;
            let mut current_volume: f32 = 0.5; // Default volume

            // Initialize with an empty sink
            {
                let initial_sink = Sink::connect_new(&mixer);
                initial_sink.set_volume(current_volume);
                let mut guard = shared_clone.lock().unwrap();
                *guard = Some(SharedSinkState { sink: initial_sink });
            }

            loop {
                if let Ok(command) = rx.recv() {
                    match command {
                        AudioCommand::Play(path) => {
                            current_path = Some(path.clone());

                            // FORCE RESET: Create a brand new Sink for every track.
                            // This ensures no leftover buffers, timing offsets, or "finished" states
                            // persist from the previous track.
                            let new_sink = Sink::connect_new(&mixer);
                            new_sink.set_volume(current_volume);

                            match File::open(&path) {
                                Ok(file) => {
                                    let reader = BufReader::new(file);
                                    match Decoder::new(reader) {
                                        Ok(source) => {
                                            new_sink.append(source);
                                            new_sink.play();
                                        },
                                        Err(e) => eprintln!("Error decoding: {}", e),
                                    }
                                },
                                Err(e) => eprintln!("Error opening file: {}", e),
                            }

                            // Swap sink into shared state
                            let mut guard = shared_clone.lock().unwrap();
                            *guard = Some(SharedSinkState { sink: new_sink });
                        },
                        AudioCommand::Toggle => {
                            let guard = shared_clone.lock().unwrap();
                            if let Some(ref state) = *guard {
                                if state.sink.is_paused() {
                                    state.sink.play();
                                } else {
                                    state.sink.pause();
                                }
                            }
                        },
                        AudioCommand::Stop => {
                            let guard = shared_clone.lock().unwrap();
                            if let Some(ref state) = *guard {
                                state.sink.stop();
                            }
                        },
                        AudioCommand::Seek(seconds) => {
                            // Try native seeking first (fast)
                            let seek_failed = {
                                let guard = shared_clone.lock().unwrap();
                                if let Some(ref state) = *guard {
                                    state.sink.try_seek(Duration::from_secs(seconds)).is_err()
                                } else {
                                    true
                                }
                            };

                            if seek_failed {
                                // Fallback: re-open file and skip
                                if let Some(ref path) = current_path {
                                    let new_sink = Sink::connect_new(&mixer);
                                    new_sink.set_volume(current_volume);

                                    match File::open(path) {
                                        Ok(file) => {
                                            let reader = BufReader::new(file);
                                            match Decoder::new(reader) {
                                                Ok(source) => {
                                                    new_sink.append(source.skip_duration(Duration::from_secs(seconds)));
                                                    new_sink.play();
                                                },
                                                Err(e) => eprintln!("Error decoding for seek: {}", e),
                                            }
                                        },
                                        Err(e) => eprintln!("Error opening file for seek: {}", e),
                                    }

                                    let mut guard = shared_clone.lock().unwrap();
                                    *guard = Some(SharedSinkState { sink: new_sink });
                                }
                            }
                        },
                        AudioCommand::SetVolume(vol) => {
                            current_volume = vol.clamp(0.0, 1.0);
                            let guard = shared_clone.lock().unwrap();
                            if let Some(ref state) = *guard {
                                state.sink.set_volume(current_volume);
                            }
                        },
                    }
                }
            }
        });

        Self {
            sender: Mutex::new(tx),
            shared,
        }
    }

    /// Get the actual playback position and whether the track has finished.
    pub fn get_status(&self) -> PlaybackStatus {
        let guard = self.shared.lock().unwrap();
        if let Some(ref state) = *guard {
            PlaybackStatus {
                position_secs: state.sink.get_pos().as_secs_f64(),
                finished: state.sink.empty(),
            }
        } else {
            PlaybackStatus {
                position_secs: 0.0,
                finished: true,
            }
        }
    }

    pub fn play(&self, path: String) -> Result<(), String> {
        self.sender
            .lock()
            .map_err(|_| "Failed to lock sender".to_string())?
            .send(AudioCommand::Play(path))
            .map_err(|e| e.to_string())
    }

    pub fn pause_toggle(&self) -> Result<(), String> {
        self.sender
            .lock()
            .map_err(|_| "Failed to lock sender".to_string())?
            .send(AudioCommand::Toggle)
            .map_err(|e| e.to_string())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.sender
            .lock()
            .map_err(|_| "Failed to lock sender".to_string())?
            .send(AudioCommand::Stop)
            .map_err(|e| e.to_string())
    }

    pub fn seek(&self, seconds: u64) -> Result<(), String> {
        self.sender
            .lock()
            .map_err(|_| "Failed to lock sender".to_string())?
            .send(AudioCommand::Seek(seconds))
            .map_err(|e| e.to_string())
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.sender
            .lock()
            .map_err(|_| "Failed to lock sender".to_string())?
            .send(AudioCommand::SetVolume(volume))
            .map_err(|e| e.to_string())
    }
}

