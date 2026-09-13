use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Default)]
struct PlayStats {
    counts: HashMap<String, u64>,
}

fn get_analytics_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or(PathBuf::from("."));
    path.push("luma");
    let _ = fs::create_dir_all(&path);
    path.push("analytics.json");
    path
}

fn load_stats() -> PlayStats {
    let path = get_analytics_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(stats) = serde_json::from_str(&content) {
                return stats;
            }
        }
    }
    PlayStats::default()
}

fn save_stats(stats: &PlayStats) -> Result<(), String> {
    let path = get_analytics_path();
    crate::storage::write_json(&path, stats)
}

#[tauri::command(async)]
pub fn increment_play_count(path: String) -> Result<u64, String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let mut stats = load_stats();
    let count = stats.counts.entry(path).or_insert(0);
    *count += 1;
    let new_count = *count;
    save_stats(&stats)?;
    Ok(new_count)
}

#[derive(Debug, Serialize)]
pub struct SongPlayCount {
    pub path: String,
    pub count: u64,
}

#[tauri::command(async)]
pub fn get_play_stats() -> Result<Vec<SongPlayCount>, String> {
    let stats = load_stats();
    let mut result: Vec<SongPlayCount> = stats
        .counts
        .into_iter()
        .map(|(path, count)| SongPlayCount { path, count })
        .collect();
    // Sort by count descending
    result.sort_by(|a, b| b.count.cmp(&a.count));
    Ok(result)
}
