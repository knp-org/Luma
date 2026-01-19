use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::io::Write;

fn get_lyrics_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or(PathBuf::from("."));
    path.push("luma");
    let _ = fs::create_dir_all(&path);
    path.push("lyrics.json");
    path
}

fn load_lyrics_store() -> HashMap<String, String> {
    let path = get_lyrics_path();
    if !path.exists() {
        return HashMap::new();
    }
    
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

fn save_lyrics_store(store: &HashMap<String, String>) -> Result<(), String> {
    let path = get_lyrics_path();
    let json = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    let mut file = fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_song_lyrics(song_path: String) -> Result<Option<String>, String> {
    let store = load_lyrics_store();
    Ok(store.get(&song_path).cloned())
}

#[tauri::command]
pub fn save_song_lyrics(song_path: String, lyrics: String) -> Result<(), String> {
    let mut store = load_lyrics_store();
    
    if lyrics.trim().is_empty() {
        store.remove(&song_path);
    } else {
        store.insert(song_path, lyrics);
    }
    
    save_lyrics_store(&store)
}

#[tauri::command]
pub fn delete_song_lyrics(song_path: String) -> Result<(), String> {
    let mut store = load_lyrics_store();
    store.remove(&song_path);
    save_lyrics_store(&store)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LrcLibResponse {
    #[allow(dead_code)]
    id: Option<i64>,
    #[allow(dead_code)]
    track_name: Option<String>,
    #[allow(dead_code)]
    artist_name: Option<String>,
    #[allow(dead_code)]
    album_name: Option<String>,
    #[allow(dead_code)]
    duration: Option<f64>,
    #[allow(dead_code)]
    instrumental: Option<bool>,
    plain_lyrics: Option<String>,
    synced_lyrics: Option<String>,
}

#[tauri::command]
pub fn fetch_lyrics_online(
    track_name: String,
    artist_name: String,
    album_name: String,
    duration: u64,
) -> Result<Option<String>, String> {
    let client = reqwest::blocking::Client::new();
    
    let url = format!(
        "https://lrclib.net/api/get?track_name={}&artist_name={}&album_name={}&duration={}",
        urlencoding::encode(&track_name),
        urlencoding::encode(&artist_name),
        urlencoding::encode(&album_name),
        duration
    );
    
    let response = client
        .get(&url)
        .header("User-Agent", "Luma Music Player v0.1.0 (https://github.com/luma)")
        .send()
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if response.status() == 404 {
        return Ok(None);
    }
    
    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }
    
    let data: LrcLibResponse = response
        .json()
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    // Prefer synced lyrics over plain lyrics
    if let Some(synced) = data.synced_lyrics {
        if !synced.trim().is_empty() {
            return Ok(Some(synced));
        }
    }
    
    if let Some(plain) = data.plain_lyrics {
        if !plain.trim().is_empty() {
            return Ok(Some(plain));
        }
    }
    
    Ok(None)
}
