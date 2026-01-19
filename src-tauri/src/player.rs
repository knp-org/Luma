use std::thread;
use std::sync::{mpsc, Mutex};
use std::fs::File;
use std::io::BufReader;
use std::time::Duration;
use rodio::{Decoder, Source, OutputStreamBuilder, Sink};

pub enum AudioCommand {
    Play(String),
    Toggle,
    Stop,
    Seek(u64),
    SetVolume(f32),
}

pub struct AudioPlayer {
    sender: Mutex<mpsc::Sender<AudioCommand>>,
}

impl AudioPlayer {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();

        // Spawn audio thread
        thread::spawn(move || {
            // Create output stream using rodio 0.21 API
            let stream = OutputStreamBuilder::open_default_stream()
                .expect("Failed to open default audio stream");
            let mixer = stream.mixer();
            
            // Create a Sink connected to the mixer
            let mut sink = Sink::connect_new(&mixer);
            let mut current_path: Option<String> = None;
            let mut current_volume: f32 = 0.5; // Default volume

            loop {
                if let Ok(command) = rx.recv() {
                    match command {
                        AudioCommand::Play(path) => {
                            current_path = Some(path.clone());
                            
                            // FORCE RESET: Create a brand new Sink for every track.
                            // This ensures no leftover buffers, timing offsets, or "finished" states
                            // persist from the previous track.
                            sink = Sink::connect_new(&mixer);
                            sink.set_volume(current_volume);

                            match File::open(&path) {
                                Ok(file) => {
                                    let reader = BufReader::new(file);
                                    match Decoder::new(reader) {
                                        Ok(source) => {
                                            sink.append(source);
                                            sink.play();
                                        },
                                        Err(e) => eprintln!("Error decoding: {}", e),
                                    }
                                },
                                Err(e) => eprintln!("Error opening file: {}", e),
                            }
                        },
                        AudioCommand::Toggle => {
                            if sink.is_paused() {
                                sink.play();
                            } else {
                                sink.pause();
                            }
                        },
                        AudioCommand::Stop => {
                            sink.stop();
                        },
                        AudioCommand::Seek(seconds) => {
                            // Try native seeking first (fast)
                            let seek_result = sink.try_seek(Duration::from_secs(seconds));
                            
                            if seek_result.is_err() {
                                // Fallback: re-open file and skip
                                if let Some(ref path) = current_path {
                                    // For fallback seek, we also want a fresh start to avoid glitches
                                    sink = Sink::connect_new(&mixer);
                                    sink.set_volume(current_volume);
                                    
                                    match File::open(path) {
                                        Ok(file) => {
                                            let reader = BufReader::new(file);
                                            match Decoder::new(reader) {
                                                Ok(source) => {
                                                    sink.append(source.skip_duration(Duration::from_secs(seconds)));
                                                    sink.play();
                                                },
                                                Err(e) => eprintln!("Error decoding for seek: {}", e),
                                            }
                                        },
                                        Err(e) => eprintln!("Error opening file for seek: {}", e),
                                    }
                                }
                            }
                        },
                        AudioCommand::SetVolume(vol) => {
                            // vol should be 0.0 to 1.0
                            current_volume = vol.clamp(0.0, 1.0);
                            sink.set_volume(current_volume);
                        },
                    }
                }
            }
        });

        Self {
            sender: Mutex::new(tx),
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

