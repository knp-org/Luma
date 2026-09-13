use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct AudioSettings {
    pub gapless: bool,
    pub crossfade_seconds: f32,
    pub replay_gain: bool,
    pub eq_low: f32,
    pub eq_mid: f32,
    pub eq_high: f32,
}
impl Default for AudioSettings {
    fn default() -> Self {
        Self {
            gapless: true,
            crossfade_seconds: 0.0,
            replay_gain: false,
            eq_low: 0.0,
            eq_mid: 0.0,
            eq_high: 0.0,
        }
    }
}
impl AudioSettings {
    pub fn validate(&self) -> Result<(), String> {
        if !self.crossfade_seconds.is_finite()
            || !(0.0..=12.0).contains(&self.crossfade_seconds)
            || [self.eq_low, self.eq_mid, self.eq_high]
                .iter()
                .any(|v| !v.is_finite() || !(-12.0..=12.0).contains(v))
        {
            return Err("Crossfade must be 0–12 seconds and EQ must be -12–12 dB".into());
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub music_directory: String,
    pub music_directories: Vec<String>,
    pub watch_library: bool,
    pub theme: String,
    pub seek_interval: u64,
    pub audio: AudioSettings,
}
impl Default for AppSettings {
    fn default() -> Self {
        Self {
            music_directory: dirs::audio_dir()
                .unwrap_or(PathBuf::from("Music"))
                .to_string_lossy()
                .to_string(),
            music_directories: vec![],
            watch_library: true,
            theme: "dark".into(),
            seek_interval: 10,
            audio: AudioSettings::default(),
        }
    }
}
impl AppSettings {
    pub fn directories(&self) -> Vec<String> {
        if self.music_directories.is_empty() {
            vec![self.music_directory.clone()]
        } else {
            self.music_directories.clone()
        }
    }
}
fn settings_path() -> PathBuf {
    let path = dirs::config_dir()
        .unwrap_or(PathBuf::from("."))
        .join("luma");
    let _ = fs::create_dir_all(&path);
    path.join("settings.json")
}
pub(crate) fn settings_stamp() -> Option<(std::time::SystemTime, u64)> {
    let metadata = fs::metadata(settings_path()).ok()?;
    Some((metadata.modified().ok()?, metadata.len()))
}

#[tauri::command(async)]
pub fn load_settings() -> Result<AppSettings, String> {
    let path = settings_path();
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    serde_json::from_str(&fs::read_to_string(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}
#[tauri::command(async)]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    settings.audio.validate()?;
    if settings.directories().iter().any(|s| s.trim().is_empty())
        || settings.seek_interval == 0
        || settings.seek_interval > 300
    {
        return Err("Provide music folders and a seek interval between 1 and 300 seconds".into());
    }
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    crate::storage::write_json(&settings_path(), &settings)?;
    crate::library_watch::settings_changed();
    Ok(())
}
