use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub music_directory: String,
    pub theme: String, // light/dark
    pub seek_interval: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            music_directory: dirs::audio_dir()
                .unwrap_or(PathBuf::from("Music"))
                .to_string_lossy()
                .to_string(),
            theme: "dark".to_string(),
            seek_interval: 10,
        }
    }
}

fn get_settings_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or(PathBuf::from("."));
    path.push("luma");
    let _ = fs::create_dir_all(&path);
    path.push("settings.json");
    path
}

#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
    let path = get_settings_path();
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let settings = serde_json::from_str(&content).unwrap_or(AppSettings::default());
    Ok(settings)
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    
    let mut file = fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}
