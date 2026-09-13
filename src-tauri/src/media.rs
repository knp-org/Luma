use serde::Deserialize;
use std::sync::{mpsc, Mutex, OnceLock};
#[derive(Clone, Deserialize)]
pub struct MediaState {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    duration: f64,
    position: f64,
    playing: bool,
    volume: f64,
}
static SENDER: OnceLock<Mutex<mpsc::Sender<MediaState>>> = OnceLock::new();
#[tauri::command]
pub fn update_media(state: MediaState) -> Result<(), String> {
    if let Some(sender) = SENDER.get() {
        sender
            .lock()
            .map_err(|e| e.to_string())?
            .send(state)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[cfg(target_os = "linux")]
pub fn start(app: tauri::AppHandle) {
    use souvlaki::{
        MediaControlEvent as Event, MediaControls, MediaMetadata, MediaPlayback, MediaPosition,
        PlatformConfig, SeekDirection,
    };
    use std::{thread, time::Duration};
    use tauri::{Emitter, Manager};
    let (tx, rx) = mpsc::channel::<MediaState>();
    thread::spawn(move || {
        let config = PlatformConfig {
            dbus_name: "luma",
            display_name: "Luma",
            hwnd: None,
        };
        let mut controls = match MediaControls::new(config) {
            Ok(controls) => controls,
            Err(e) => {
                eprintln!("Desktop media controls unavailable: {e}");
                return;
            }
        };
        let events = app.clone();
        if let Err(e) = controls.attach(move |event| {
            let (action, value) = match event {
                Event::Play => ("play", 0.0),
                Event::Pause => ("pause", 0.0),
                Event::Toggle => ("toggle", 0.0),
                Event::Next => ("next", 0.0),
                Event::Previous => ("previous", 0.0),
                Event::Stop => ("stop", 0.0),
                Event::SetPosition(position) => ("seek", position.0.as_secs_f64()),
                Event::SeekBy(direction, duration) => (
                    "seekBy",
                    duration.as_secs_f64()
                        * if direction == SeekDirection::Forward {
                            1.0
                        } else {
                            -1.0
                        },
                ),
                Event::Seek(direction) => (
                    "seekBy",
                    if direction == SeekDirection::Forward {
                        10.0
                    } else {
                        -10.0
                    },
                ),
                Event::SetVolume(volume) => ("volume", volume),
                Event::Raise => {
                    if let Some(window) = events.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                    return;
                }
                Event::Quit => ("quit", 0.0),
                _ => return,
            };
            let _ = events.emit(
                "media-control",
                serde_json::json!({ "action": action, "value": value }),
            );
        }) {
            eprintln!("Could not attach media controls: {e}");
            return;
        }
        let _ = SENDER.set(Mutex::new(tx));
        while let Ok(state) = rx.recv() {
            let duration = |seconds: f64| {
                Duration::from_secs_f64(if seconds.is_finite() {
                    seconds.max(0.0)
                } else {
                    0.0
                })
            };
            let _ = controls.set_metadata(MediaMetadata {
                title: state.title.as_deref(),
                artist: state.artist.as_deref(),
                album: state.album.as_deref(),
                duration: Some(duration(state.duration)),
                ..Default::default()
            });
            let progress = Some(MediaPosition(duration(state.position)));
            let playback = if state.title.is_none() {
                MediaPlayback::Stopped
            } else if state.playing {
                MediaPlayback::Playing { progress }
            } else {
                MediaPlayback::Paused { progress }
            };
            let _ = controls.set_playback(playback);
            let _ = controls.set_volume(state.volume.clamp(0.0, 1.0));
        }
    });
}
#[cfg(not(target_os = "linux"))]
pub fn start(_app: tauri::AppHandle) {}
