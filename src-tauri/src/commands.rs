use serde::{Serialize, Deserialize};
use walkdir::WalkDir;
use lofty::prelude::*;
use lofty::read_from_path;
use lofty::config::WriteOptions;
use base64::{Engine as _, engine::general_purpose};
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct Song {
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    genre: Option<String>,
    track_number: Option<u32>,
    year: Option<u32>,
    duration_seconds: u64,
    bitrate: Option<u32>,        // kbps
    sample_rate: Option<u32>,    // Hz
    bits_per_sample: Option<u8>,
    channels: Option<u8>,
    file_size_bytes: u64,
    has_album_art: bool,
    cover_handle: Option<String>,
    lyrics: Option<String>,
}

use rayon::prelude::*;
use std::path::PathBuf;
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;

fn get_thumbnails_dir() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or(PathBuf::from("."));
    path.push("luma");
    path.push("thumbnails");
    let _ = fs::create_dir_all(&path);
    path
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    current: usize,
    total: usize,
}

use tauri::Emitter;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use image::{ImageFormat, imageops::FilterType};
use std::io::Cursor;
use lofty::probe::Probe;
use lofty::file::TaggedFileExt;
use lofty::tag::Accessor;

#[tauri::command]
pub async fn scan_music_dir(app: tauri::AppHandle, directory: String) -> Result<Vec<Song>, String> {
    let root_path = PathBuf::from(directory);
    let thumb_dir = get_thumbnails_dir();

    // Collect all valid audio file paths first
    let entries: Vec<_> = WalkDir::new(&root_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| {
             let ext = ext.to_string_lossy().to_lowercase();
             matches!(ext.as_str(), "mp3" | "flac" | "wav" | "m4a" | "ogg")
        }))
        .collect();
    
    let total_songs = entries.len();
    let processed = Arc::new(AtomicUsize::new(0));
    let app_clone = app.clone();

    // Process files in parallel using rayon
    let songs: Vec<Song> = entries.par_iter().map(|entry| {
        let path = entry.path();
        let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        
        let song = match Probe::open(path).expect("ERROR: Bad path provided!").read() {
            Ok(tagged_file) => {
                let tag = tagged_file.primary_tag();
                let properties = tagged_file.properties();
                
                let title = tag.as_ref().and_then(|t| t.title().map(|s| s.to_string()));
                let artist = tag.as_ref().and_then(|t| t.artist().map(|s| s.to_string()));
                let album = tag.as_ref().and_then(|t| t.album().map(|s| s.to_string()));
                let genre = tag.as_ref().and_then(|t| t.genre().map(|s| s.to_string()));
                let track_number = tag.as_ref().and_then(|t| t.track());
                let year = tag.as_ref().and_then(|t| t.year());
                let lyrics = tag.as_ref().and_then(|t| t.get_string(&lofty::tag::ItemKey::Lyrics).map(|s| s.to_string()));
                
                // Art Extraction & Resizing
                let mut has_album_art = false;
                let mut cover_handle = None;
                
                if let Some(t) = tag {
                    let pictures = t.pictures();
                    if let Some(pic) = pictures.first() {
                         has_album_art = true;
                         
                         // Process image: Resize to thumbnail
                         if let Ok(img) = image::load_from_memory(pic.data()) {
                             let thumbnail = img.resize(250, 250, FilterType::Lanczos3);
                             
                             let mut thumb_bytes: Vec<u8> = Vec::new();
                             if thumbnail.write_to(&mut Cursor::new(&mut thumb_bytes), ImageFormat::Jpeg).is_ok() {
                                 // Hash the RESIZED bytes for the handle
                                 let mut hasher = DefaultHasher::new();
                                 thumb_bytes.hash(&mut hasher);
                                 let hash = hasher.finish();
                                 let hash_str = format!("{:x}", hash);
                                 
                                 let mut current_thumb_path = thumb_dir.clone(); // Clone for each thread
                                 current_thumb_path.push(format!("{}.bin", hash_str));
                                 
                                 // Save only if doesn't exist (deduplication)
                                 if !current_thumb_path.exists() {
                                     let _ = fs::write(&current_thumb_path, &thumb_bytes);
                                 }
                                 cover_handle = Some(hash_str);
                             }
                         }
                    }
                }

                Song {
                    path: path.to_string_lossy().to_string(),
                    title: title.or_else(|| Some(path.file_name().unwrap_or_default().to_string_lossy().to_string())),
                    artist,
                    album,
                    genre,
                    track_number,
                    year,
                    duration_seconds: properties.duration().as_secs(),
                    bitrate: properties.audio_bitrate(),
                    sample_rate: properties.sample_rate(),
                    bits_per_sample: properties.bit_depth(),
                    channels: properties.channels(),
                    file_size_bytes: file_size,
                    has_album_art,
                    cover_handle,
                    lyrics,
                }
            },
            Err(_) => {
                // Fallback for untagged files
                Song {
                    path: path.to_string_lossy().to_string(),
                    title: Some(path.file_name().unwrap_or_default().to_string_lossy().to_string()),
                    artist: None,
                    album: None,
                    genre: None,
                    track_number: None,
                    year: None,
                    duration_seconds: 0,
                    bitrate: None,
                    sample_rate: None,
                    bits_per_sample: None,
                    channels: None,
                    file_size_bytes: file_size,
                    has_album_art: false,
                    cover_handle: None,
                    lyrics: None,
                }
            }
        };

        // Emit progress
        let count = processed.fetch_add(1, Ordering::SeqCst) + 1;
        if count % 10 == 0 || count == total_songs {
            let _ = app_clone.emit("sync-progress", ProgressPayload {
                current: count,
                total: total_songs,
            });
        }

        song
    }).collect();

    // 3. Save to cache
    if let Err(e) = save_library_cache(&songs) {
        eprintln!("Failed to save library cache: {}", e);
    }
    
    Ok(songs)
}

#[tauri::command]
pub fn clear_cache() -> Result<(), String> {
    let lib_path = get_library_path();
    let thumb_dir = get_thumbnails_dir();
    
    if lib_path.exists() {
        let _ = fs::remove_file(lib_path);
    }
    
    if thumb_dir.exists() {
        let _ = fs::remove_dir_all(&thumb_dir);
        let _ = fs::create_dir_all(&thumb_dir);
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_cache_size() -> Result<u64, String> {
    let mut total_size = 0;
    
    let lib_path = get_library_path();
    if let Ok(metadata) = fs::metadata(lib_path) {
        total_size += metadata.len();
    }
    
    let thumb_dir = get_thumbnails_dir();
    if let Ok(entries) = fs::read_dir(thumb_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    total_size += metadata.len();
                }
            }
        }
    }
    
    Ok(total_size)
}

#[tauri::command]
pub fn get_thumbnail(handle: String) -> Result<Option<String>, String> {
    let mut thumb_path = get_thumbnails_dir();
    thumb_path.push(format!("{}.bin", handle));
    
    if !thumb_path.exists() {
        return Ok(None);
    }

    let data = fs::read(thumb_path).map_err(|e| e.to_string())?;
    
    // We don't have the mime type readily available in the filename, 
    // but we can guess or just use image/jpeg (browsers are usually smart enough)
    // For better precision, we could have saved the mime type in the filename extension.
    let base64_data = general_purpose::STANDARD.encode(&data);
    Ok(Some(format!("data:image/jpeg;base64,{}", base64_data)))
}

#[tauri::command]
pub fn get_song_art(path: String) -> Result<Option<String>, String> {
    // Keep this for cases where we don't have a handle yet (e.g. single file drag drop if we add it)
    let path_buf = PathBuf::from(path);
    match read_from_path(&path_buf) {
        Ok(tagged_file) => {
            if let Some(tag) = tagged_file.primary_tag() {
                if let Some(pic) = tag.pictures().first() {
                     let mime = match pic.mime_type() {
                        Some(lofty::picture::MimeType::Png) => "image/png",
                        Some(lofty::picture::MimeType::Jpeg) => "image/jpeg",
                        Some(lofty::picture::MimeType::Gif) => "image/gif",
                        Some(lofty::picture::MimeType::Bmp) => "image/bmp",
                        _ => "image/jpeg",
                    };
                    let base64_data = general_purpose::STANDARD.encode(pic.data());
                    return Ok(Some(format!("data:{};base64,{}", mime, base64_data)));
                }
            }
            Ok(None)
        },
        Err(e) => Err(e.to_string())
    }
}

fn get_library_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or(PathBuf::from("."));
    path.push("luma");
    let _ = fs::create_dir_all(&path);
    path.push("library.json");
    path
}

fn save_library_cache(songs: &Vec<Song>) -> Result<(), String> {
    let path = get_library_path();
    let json = serde_json::to_string(songs).map_err(|e| e.to_string())?;
    
    use std::io::Write;
    let mut file = fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_cached_library() -> Result<Vec<Song>, String> {
    let path = get_library_path();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let songs: Vec<Song> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(songs)
}

use crate::player::AudioPlayer;
use tauri::State;

#[tauri::command]
pub fn play_track(state: State<'_, AudioPlayer>, path: String) -> Result<(), String> {
    state.play(path)
}

#[tauri::command]
pub fn toggle_playback(state: State<'_, AudioPlayer>) -> Result<(), String> {
    state.pause_toggle()
}

#[tauri::command]
pub fn stop_playback(state: State<'_, AudioPlayer>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
pub fn seek_track(state: State<'_, AudioPlayer>, seconds: u64) -> Result<(), String> {
    state.seek(seconds)
}

#[tauri::command]
pub fn set_player_volume(state: State<'_, AudioPlayer>, volume: f32) -> Result<(), String> {
    state.set_volume(volume)
}

#[tauri::command]
pub fn update_song_metadata(
    path: String,
    title: String,
    artist: String,
    album: String,
    genre: String,
    year: Option<u32>,
    track_number: Option<u32>
) -> Result<(), String> {
    let path_buf = PathBuf::from(path);
    
    // Open file using Lofty
    let mut tagged_file = match read_from_path(&path_buf) {
        Ok(f) => f,
        Err(e) => return Err(format!("Failed to read file: {}", e)),
    };

    // Get primary tag or insert a new one
    let tag = match tagged_file.primary_tag_mut() {
        Some(t) => t,
        None => {
            let tag_type = tagged_file.file_type().primary_tag_type();
            tagged_file.insert_tag(lofty::tag::Tag::new(tag_type));
            tagged_file.primary_tag_mut().unwrap()
        }
    };

    // Update fields
    tag.set_title(title);
    tag.set_artist(artist);
    tag.set_album(album);
    tag.set_genre(genre);
    
    if let Some(y) = year {
        tag.set_year(y);
    } else {
        tag.remove_key(&lofty::tag::ItemKey::Year);
    }

    if let Some(t) = track_number {
        tag.set_track(t);
    } else {
        tag.remove_key(&lofty::tag::ItemKey::TrackNumber);
    }

    // Save changes
    if let Err(e) = tagged_file.save_to_path(&path_buf, WriteOptions::default()) {
         return Err(format!("Failed to save metadata: {}", e));
    }

    Ok(())
}
