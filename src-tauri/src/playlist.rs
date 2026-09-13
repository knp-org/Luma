use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct Playlist {
    pub name: String,
    pub created_at: u64,     // Unix timestamp
    pub tracks: Vec<String>, // List of file paths
}

fn get_playlist_dir() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or(PathBuf::from("."));
    path.push("luma");
    path.push("playlists");
    let _ = fs::create_dir_all(&path);
    path
}

#[tauri::command(async)]
pub fn create_playlist(name: String) -> Result<Playlist, String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Playlist name cannot be empty".into());
    }
    let mut path = get_playlist_dir();
    // Sanitize filename roughly
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "");
    if safe_name.trim().is_empty() {
        return Err("Use letters or numbers in the playlist name".into());
    }
    path.push(format!("{}.json", safe_name));

    if path.exists() {
        return Err("Playlist already exists".into());
    }

    let playlist = Playlist {
        name,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tracks: Vec::new(),
    };

    crate::storage::write_json(&path, &playlist)?;

    Ok(playlist)
}

#[tauri::command(async)]
pub fn get_playlists() -> Result<Vec<Playlist>, String> {
    let dir = get_playlist_dir();
    let mut playlists = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(pl) = serde_json::from_str::<Playlist>(&content) {
                        playlists.push(pl);
                    }
                }
            }
        }
    }

    // Sort by creation time newest first?
    playlists.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(playlists)
}

#[tauri::command(async)]
pub fn add_to_playlist(playlist_name: String, song_path: String) -> Result<Playlist, String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let dir = get_playlist_dir();
    // We need to find the file that matches this name.
    // Ideally we store filename as ID, but for now scan:
    let safe_name =
        playlist_name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "");
    let path = dir.join(format!("{}.json", safe_name));

    if !path.exists() {
        return Err("Playlist not found".into());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut playlist: Playlist = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Avoid duplicates?
    if !playlist.tracks.contains(&song_path) {
        playlist.tracks.push(song_path);

        // Save back
        crate::storage::write_json(&path, &playlist)?;
    }

    Ok(playlist)
}

#[tauri::command(async)]
pub fn remove_from_playlist(playlist_name: String, song_path: String) -> Result<Playlist, String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let dir = get_playlist_dir();
    let safe_name =
        playlist_name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "");
    let path = dir.join(format!("{}.json", safe_name));

    if !path.exists() {
        return Err("Playlist not found".into());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut playlist: Playlist = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Remove the track
    if let Some(pos) = playlist.tracks.iter().position(|t| t == &song_path) {
        playlist.tracks.remove(pos);

        // Save back
        crate::storage::write_json(&path, &playlist)?;
    }

    Ok(playlist)
}

#[tauri::command(async)]
pub fn delete_playlist(playlist_name: String) -> Result<(), String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let dir = get_playlist_dir();
    let safe_name =
        playlist_name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "");
    let path = dir.join(format!("{}.json", safe_name));

    if !path.exists() {
        return Err("Playlist not found".into());
    }

    fs::remove_file(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command(async)]
pub fn save_queue_playlist(name: String, tracks: Vec<String>) -> Result<Playlist, String> {
    let name = name.trim().to_string();
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "");
    if safe_name.trim().is_empty() {
        return Err("Use letters or numbers in the playlist name".into());
    }
    if tracks.is_empty() {
        return Err("The queue is empty".into());
    }
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let path = get_playlist_dir().join(format!("{}.json", safe_name));
    if path.exists() {
        return Err("Playlist already exists".into());
    }
    let playlist = Playlist {
        name,
        tracks,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };
    crate::storage::write_json(&path, &playlist)?;
    Ok(playlist)
}
