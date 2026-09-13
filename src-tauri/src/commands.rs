use base64::{engine::general_purpose, Engine as _};
use lofty::config::WriteOptions;
use lofty::prelude::*;
use lofty::read_from_path;
use serde::{Deserialize, Serialize};
use std::fs;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    genre: Option<String>,
    track_number: Option<u32>,
    year: Option<u32>,
    duration_seconds: u64,
    bitrate: Option<u32>,     // kbps
    sample_rate: Option<u32>, // Hz
    bits_per_sample: Option<u8>,
    channels: Option<u8>,
    file_size_bytes: u64,
    has_album_art: bool,
    cover_handle: Option<String>,
    lyrics: Option<String>,
    #[serde(default)]
    added_at: u64,
    #[serde(default)]
    missing: bool,
    #[serde(default)]
    modified_at: u64,
}

use rayon::prelude::*;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;

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

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::Emitter;

use image::{imageops::FilterType, ImageFormat};
use lofty::file::TaggedFileExt;
use lofty::probe::Probe;
use lofty::tag::Accessor;
use std::io::Cursor;

#[derive(Serialize, Clone)]
pub struct ScanResult {
    pub songs: Vec<Song>,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub async fn scan_music_dir(
    app: tauri::AppHandle,
    directories: Vec<String>,
) -> Result<ScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || scan_directories(app, directories))
        .await
        .map_err(|e| e.to_string())?
}

pub fn scan_directories(
    app: tauri::AppHandle,
    directories: Vec<String>,
) -> Result<ScanResult, String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    scan_with_cache(
        Some(app),
        directories,
        &get_library_path(),
        get_thumbnails_dir(),
    )
}

pub fn scan_changed_paths(
    app: tauri::AppHandle,
    directories: Vec<String>,
    paths: Vec<PathBuf>,
) -> Result<ScanResult, String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    scan_scoped_with_cache(
        Some(app),
        directories,
        &get_library_path(),
        get_thumbnails_dir(),
        Some(paths),
    )
}

pub(crate) fn is_music_path(path: &std::path::Path) -> bool {
    path.extension().is_some_and(|ext| {
        matches!(
            ext.to_string_lossy().to_lowercase().as_str(),
            "mp3" | "flac" | "wav" | "m4a" | "ogg" | "aac" | "aiff" | "aif"
        )
    })
}

fn scan_with_cache(
    app: Option<tauri::AppHandle>,
    directories: Vec<String>,
    library_path: &std::path::Path,
    thumb_dir: PathBuf,
) -> Result<ScanResult, String> {
    scan_scoped_with_cache(app, directories, library_path, thumb_dir, None)
}

fn scan_scoped_with_cache(
    app: Option<tauri::AppHandle>,
    directories: Vec<String>,
    library_path: &std::path::Path,
    thumb_dir: PathBuf,
    scope: Option<Vec<PathBuf>>,
) -> Result<ScanResult, String> {
    if directories.is_empty() {
        return Err("Choose at least one music folder".into());
    }
    let old_songs = read_library_cache(library_path).unwrap_or_default();
    let old_by_path: std::collections::HashMap<_, _> = old_songs
        .iter()
        .map(|song| (song.path.as_str(), song))
        .collect();
    fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    let mut warnings = Vec::new();
    let mut entries = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let roots: Vec<_> = directories
        .iter()
        .map(|directory| {
            let root = PathBuf::from(directory);
            if !root.is_dir() {
                warnings.push(format!("Folder unavailable: {}", directory));
            }
            fs::canonicalize(&root).unwrap_or(root)
        })
        .collect();
    let scope = scope.map(|paths| {
        let mut paths: Vec<_> = paths
            .into_iter()
            .map(|path| fs::canonicalize(&path).unwrap_or(path))
            .filter(|path| roots.iter().any(|root| path.starts_with(root)))
            .collect();
        paths.sort();
        paths.dedup();
        // A parent directory scan already covers all its changed descendants.
        let mut minimal: Vec<PathBuf> = Vec::new();
        for path in paths {
            if !minimal.iter().any(|parent| path.starts_with(parent)) {
                minimal.push(path);
            }
        }
        minimal
    });
    for root in scope.as_ref().unwrap_or(&roots) {
        // Deleted files/directories are reconciled from the cached paths below.
        if !root.exists() {
            continue;
        }
        for entry in WalkDir::new(root) {
            match entry {
                Ok(entry) if entry.file_type().is_file() && is_music_path(entry.path()) => {
                    if let Ok(path) = fs::canonicalize(entry.path()) {
                        if seen.insert(path) {
                            entries.push(entry);
                        }
                    }
                }
                Err(e) => warnings.push(e.to_string()),
                _ => {}
            }
        }
    }
    let failures = std::sync::Mutex::new(Vec::new());
    let total_songs = entries.len();
    let processed = Arc::new(AtomicUsize::new(0));
    let app_clone = app.clone();

    // Process files in parallel using rayon
    let mut songs: Vec<Song> = entries
        .par_iter()
        .filter_map(|entry| {
            let canonical =
                fs::canonicalize(entry.path()).unwrap_or_else(|_| entry.path().to_path_buf());
            let path = canonical.as_path();
            let metadata = entry.metadata().ok();
            let file_size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified_at = metadata
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|t| t.as_millis() as u64)
                .unwrap_or(0);
            if let Some(old) = old_by_path.get(path.to_string_lossy().as_ref()) {
                if !old.missing
                    && old.modified_at == modified_at
                    && modified_at > 0
                    && old.file_size_bytes == file_size
                    && old
                        .cover_handle
                        .as_ref()
                        .is_none_or(|handle| thumb_dir.join(format!("{handle}.bin")).exists())
                {
                    processed.fetch_add(1, Ordering::SeqCst);
                    return Some((*old).clone());
                }
            }
            let song = match Probe::open(path).and_then(|probe| probe.read()) {
                Ok(tagged_file) => {
                    let tag = tagged_file.primary_tag();
                    let properties = tagged_file.properties();

                    let title = tag.as_ref().and_then(|t| t.title().map(|s| s.to_string()));
                    let artist = tag.as_ref().and_then(|t| t.artist().map(|s| s.to_string()));
                    let album = tag.as_ref().and_then(|t| t.album().map(|s| s.to_string()));
                    let genre = tag.as_ref().and_then(|t| t.genre().map(|s| s.to_string()));
                    let track_number = tag.as_ref().and_then(|t| t.track());
                    let year = tag.as_ref().and_then(|t| t.year());
                    let lyrics = tag.as_ref().and_then(|t| {
                        t.get_string(&lofty::tag::ItemKey::Lyrics)
                            .map(|s| s.to_string())
                    });

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
                                if thumbnail
                                    .write_to(&mut Cursor::new(&mut thumb_bytes), ImageFormat::Jpeg)
                                    .is_ok()
                                {
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
                        title: title.or_else(|| {
                            Some(
                                path.file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                                    .to_string(),
                            )
                        }),
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
                        added_at: old_by_path
                            .get(path.to_string_lossy().as_ref())
                            .map(|s| s.added_at)
                            .filter(|t| *t > 0)
                            .unwrap_or_else(|| {
                                std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs()
                            }),
                        missing: false,
                        modified_at,
                    }
                }
                Err(e) => {
                    failures
                        .lock()
                        .unwrap()
                        .push(format!("{}: {}", path.display(), e));
                    return None;
                }
            };

            // Emit progress
            let count = processed.fetch_add(1, Ordering::SeqCst) + 1;
            if count.is_multiple_of(10) || count == total_songs {
                if let Some(app) = &app_clone {
                    let _ = app.emit(
                        "sync-progress",
                        ProgressPayload {
                            current: count,
                            total: total_songs,
                        },
                    );
                }
            }

            Some(song)
        })
        .collect();
    if let Some(app) = &app_clone {
        let _ = app.emit(
            "sync-progress",
            ProgressPayload {
                current: total_songs,
                total: total_songs,
            },
        );
    }
    warnings.extend(failures.into_inner().unwrap_or_default());
    // Retain unavailable entries so playlists can be repaired when a drive returns.
    let scanned: std::collections::HashSet<_> =
        songs.iter().map(|song| song.path.clone()).collect();
    for mut old in old_songs {
        if roots
            .iter()
            .any(|root| PathBuf::from(&old.path).starts_with(root))
            && !scanned.contains(&old.path)
        {
            let affected = scope.as_ref().is_none_or(|paths| {
                paths
                    .iter()
                    .any(|path| PathBuf::from(&old.path).starts_with(path))
            });
            if affected {
                old.missing = true;
            }
            songs.push(old);
        }
    }
    songs.sort_by(|a, b| a.path.cmp(&b.path));

    crate::storage::write_json(library_path, &songs)?;

    Ok(ScanResult { songs, warnings })
}

#[tauri::command(async)]
pub fn clear_cache() -> Result<(), String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let lib_path = get_library_path();
    let thumb_dir = get_thumbnails_dir();

    if lib_path.exists() {
        let mut songs = get_cached_library()?;
        for song in &mut songs {
            song.modified_at = 0;
        }
        save_library_cache(&songs)?;
    }

    if thumb_dir.exists() {
        fs::remove_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command(async)]
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

#[tauri::command(async)]
pub fn get_thumbnail(handle: String) -> Result<Option<String>, String> {
    let mut thumb_path = get_thumbnails_dir();
    if handle.is_empty() || !handle.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid thumbnail handle".into());
    }
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

#[tauri::command(async)]
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
        }
        Err(e) => Err(e.to_string()),
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
    crate::storage::write_json(&path, songs)
}

#[tauri::command(async)]
pub fn get_cached_library() -> Result<Vec<Song>, String> {
    read_library_cache(&get_library_path())
}
fn read_library_cache(path: &std::path::Path) -> Result<Vec<Song>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let songs: Vec<Song> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(songs)
}

use crate::player::AudioPlayer;
use tauri::State;

#[tauri::command(async)]
pub fn play_track(
    state: State<'_, AudioPlayer>,
    path: String,
    seconds: Option<f64>,
    paused: Option<bool>,
) -> Result<crate::player::PlaybackStatus, String> {
    state.play(path, seconds.unwrap_or(0.0), paused.unwrap_or(false))
}
#[tauri::command(async)]
pub fn toggle_playback(
    state: State<'_, AudioPlayer>,
) -> Result<crate::player::PlaybackStatus, String> {
    state.pause_toggle()
}
#[tauri::command(async)]
pub fn stop_playback(
    state: State<'_, AudioPlayer>,
) -> Result<crate::player::PlaybackStatus, String> {
    state.stop()
}
#[tauri::command(async)]
pub fn seek_track(
    state: State<'_, AudioPlayer>,
    seconds: f64,
) -> Result<crate::player::PlaybackStatus, String> {
    state.seek(seconds)
}
#[tauri::command(async)]
pub fn set_player_volume(
    state: State<'_, AudioPlayer>,
    volume: f32,
) -> Result<crate::player::PlaybackStatus, String> {
    state.set_volume(volume)
}
#[tauri::command(async)]
pub fn get_playback_status(
    state: State<'_, AudioPlayer>,
) -> Result<crate::player::PlaybackStatus, String> {
    Ok(state.get_status())
}
#[tauri::command(async)]
pub fn preload_track(
    state: State<'_, AudioPlayer>,
    path: Option<String>,
    generation: u64,
) -> Result<crate::player::PlaybackStatus, String> {
    state.preload(path, generation)
}
#[tauri::command(async)]
pub fn set_audio_effects(
    state: State<'_, AudioPlayer>,
    settings: crate::settings::AudioSettings,
) -> Result<crate::player::PlaybackStatus, String> {
    state.set_effects(settings)
}

#[tauri::command(async)]
pub fn update_song_metadata(
    path: String,
    title: String,
    artist: String,
    album: String,
    genre: String,
    year: Option<u32>,
    track_number: Option<u32>,
) -> Result<(), String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    update_metadata_with_cache(
        &path,
        MetadataEdit {
            title,
            artist,
            album,
            genre,
            year,
            track_number,
        },
        &get_library_path(),
    )
}
struct MetadataEdit {
    title: String,
    artist: String,
    album: String,
    genre: String,
    year: Option<u32>,
    track_number: Option<u32>,
}
fn update_metadata_with_cache(
    path: &str,
    edit: MetadataEdit,
    library_path: &std::path::Path,
) -> Result<(), String> {
    let MetadataEdit {
        title,
        artist,
        album,
        genre,
        year,
        track_number,
    } = edit;
    let path_buf = PathBuf::from(path);
    // Read the cache before changing the audio file, so corrupt cache data cannot
    // produce a partially successful edit.
    let mut songs = read_library_cache(library_path)?;
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
    tag.set_title(title.clone());
    tag.set_artist(artist.clone());
    tag.set_album(album.clone());
    tag.set_genre(genre.clone());

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

    if let Some(song) = songs.iter_mut().find(|s| s.path == path) {
        song.title = Some(title);
        song.artist = Some(artist);
        song.album = Some(album);
        song.genre = Some(genre);
        song.year = year;
        song.track_number = track_number;
        song.file_size_bytes = fs::metadata(&path_buf)
            .map(|m| m.len())
            .unwrap_or(song.file_size_bytes);
        crate::storage::write_json(library_path, &songs)?;
    }
    Ok(())
}

#[tauri::command(async)]
pub fn relocate_music_file(old_path: String, new_path: String) -> Result<Song, String> {
    let _lock = crate::storage::DATA_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    relocate_with_cache(old_path, new_path, &get_library_path())
}
fn relocate_with_cache(
    old_path: String,
    new_path: String,
    library_path: &std::path::Path,
) -> Result<Song, String> {
    let path = fs::canonicalize(new_path.trim()).map_err(|e| e.to_string())?;
    let tagged = read_from_path(&path).map_err(|e| format!("Cannot read audio file: {e}"))?;
    let new_path = path.to_string_lossy().to_string();
    let mut songs = read_library_cache(library_path)?;
    if songs
        .iter()
        .any(|song| song.path == new_path && song.path != old_path)
    {
        return Err("That file is already in your library".into());
    }
    let song = songs
        .iter_mut()
        .find(|song| song.path == old_path)
        .ok_or("Track not found in the library")?;
    song.path = new_path.clone();
    song.missing = false;
    song.duration_seconds = tagged.properties().duration().as_secs();
    song.file_size_bytes = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    let updated = song.clone();
    let config = library_path
        .parent()
        .ok_or("Invalid library location")?
        .to_path_buf();
    let playlist_dir = config.join("playlists");
    if playlist_dir.exists() {
        for entry in fs::read_dir(playlist_dir).map_err(|e| e.to_string())? {
            let file = entry.map_err(|e| e.to_string())?.path();
            if file.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let mut playlist: crate::playlist::Playlist =
                serde_json::from_str(&fs::read_to_string(&file).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            for track in &mut playlist.tracks {
                if *track == old_path {
                    *track = new_path.clone();
                }
            }
            crate::storage::write_json(&file, &playlist)?;
        }
    }
    for name in ["lyrics.json", "analytics.json"] {
        let file = config.join(name);
        if !file.exists() {
            continue;
        }
        let mut value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&file).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        let object = if name == "analytics.json" {
            value.get_mut("counts").and_then(|v| v.as_object_mut())
        } else {
            value.as_object_mut()
        };
        if let Some(object) = object {
            if let Some(old) = object.remove(&old_path) {
                if name == "analytics.json" {
                    let count = old.as_u64().unwrap_or(0)
                        + object.get(&new_path).and_then(|v| v.as_u64()).unwrap_or(0);
                    object.insert(new_path.clone(), count.into());
                } else {
                    object.entry(new_path.clone()).or_insert(old);
                }
            }
        }
        crate::storage::write_json(&file, &value)?;
    }
    crate::storage::write_json(library_path, &songs)?;
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn wav(path: &std::path::Path) {
        // One second of valid stereo PCM, independent of a sound device.
        let size = 48_000u32 * 4;
        let mut bytes = Vec::new();
        bytes.extend(b"RIFF");
        bytes.extend((36 + size).to_le_bytes());
        bytes.extend(b"WAVEfmt ");
        bytes.extend(16u32.to_le_bytes());
        bytes.extend(1u16.to_le_bytes());
        bytes.extend(2u16.to_le_bytes());
        bytes.extend(48_000u32.to_le_bytes());
        bytes.extend(192_000u32.to_le_bytes());
        bytes.extend(4u16.to_le_bytes());
        bytes.extend(16u16.to_le_bytes());
        bytes.extend(b"data");
        bytes.extend(size.to_le_bytes());
        bytes.resize(44 + size as usize, 0);
        fs::write(path, bytes).unwrap();
    }
    #[test]
    fn scan_handles_bad_files_deduplicates_roots_and_preserves_missing_tracks() {
        let root = tempfile::tempdir().unwrap();
        let music = root.path().join("music");
        fs::create_dir(&music).unwrap();
        let audio = music.join("track.wav");
        wav(&audio);
        fs::write(music.join("broken.mp3"), b"not audio").unwrap();
        let cache = root.path().join("library.json");
        let thumbs = root.path().join("thumbs");
        let folders = vec![music.to_string_lossy().to_string(); 2];
        let result = scan_with_cache(None, folders.clone(), &cache, thumbs.clone()).unwrap();
        assert_eq!(result.songs.len(), 1);
        assert_eq!(result.warnings.len(), 1);
        assert!(!result.songs[0].missing);
        let added = result.songs[0].added_at;
        fs::remove_file(&audio).unwrap();
        let missing = scan_with_cache(None, folders.clone(), &cache, thumbs.clone()).unwrap();
        assert_eq!(missing.songs.len(), 1);
        assert!(missing.songs[0].missing);
        wav(&audio);
        let recovered = scan_with_cache(None, folders, &cache, thumbs).unwrap();
        assert!(!recovered.songs[0].missing);
        assert_eq!(recovered.songs[0].added_at, added);
    }
    #[test]
    fn targeted_scan_handles_renames_without_reading_unrelated_tracks() {
        let root = tempfile::tempdir().unwrap();
        let music = root.path().join("music");
        fs::create_dir(&music).unwrap();
        let old = music.join("old.wav");
        let unrelated = music.join("unrelated.wav");
        let renamed = music.join("renamed.wav");
        wav(&old);
        wav(&unrelated);
        let cache = root.path().join("library.json");
        let thumbs = root.path().join("thumbs");
        let directories = vec![music.to_string_lossy().to_string()];
        scan_with_cache(None, directories.clone(), &cache, thumbs.clone()).unwrap();
        fs::rename(&old, &renamed).unwrap();
        // A scoped scan must not read this changed but unreported file.
        fs::write(&unrelated, b"corrupt").unwrap();
        let result = scan_scoped_with_cache(
            None,
            directories.clone(),
            &cache,
            thumbs.clone(),
            Some(vec![old.clone(), renamed.clone()]),
        )
        .unwrap();
        assert!(result.warnings.is_empty());
        assert_eq!(result.songs.len(), 3);
        assert!(
            result
                .songs
                .iter()
                .find(|song| song.path == old.to_string_lossy())
                .unwrap()
                .missing
        );
        assert!(
            !result
                .songs
                .iter()
                .find(|song| song.path == unrelated.to_string_lossy())
                .unwrap()
                .missing
        );
        assert!(
            !result
                .songs
                .iter()
                .find(|song| song.path == renamed.to_string_lossy())
                .unwrap()
                .missing
        );
        fs::remove_dir_all(&music).unwrap();
        let removed =
            scan_scoped_with_cache(None, directories, &cache, thumbs, Some(vec![music])).unwrap();
        assert!(removed.songs.iter().all(|song| song.missing));
    }

    #[test]
    fn metadata_roundtrips_track_numbers_and_updates_cached_library() {
        let root = tempfile::tempdir().unwrap();
        let audio = root.path().join("track.wav");
        wav(&audio);
        let cache = root.path().join("library.json");
        scan_with_cache(
            None,
            vec![root.path().to_string_lossy().to_string()],
            &cache,
            root.path().join("thumbs"),
        )
        .unwrap();
        let edit = |track_number| MetadataEdit {
            title: "Updated".into(),
            artist: "Artist".into(),
            album: "Album".into(),
            genre: "Jazz".into(),
            year: Some(2001),
            track_number,
        };
        update_metadata_with_cache(audio.to_str().unwrap(), edit(Some(7)), &cache).unwrap();
        let file = read_from_path(&audio).unwrap();
        assert_eq!(file.primary_tag().unwrap().track(), Some(7));
        let songs = read_library_cache(&cache).unwrap();
        assert_eq!(songs[0].track_number, Some(7));
        assert_eq!(songs[0].title.as_deref(), Some("Updated"));
        update_metadata_with_cache(audio.to_str().unwrap(), edit(None), &cache).unwrap();
        assert_eq!(
            read_from_path(&audio)
                .unwrap()
                .primary_tag()
                .unwrap()
                .track(),
            None
        );
        assert_eq!(read_library_cache(&cache).unwrap()[0].track_number, None);
    }
    #[test]
    fn missing_root_does_not_erase_existing_library() {
        let root = tempfile::tempdir().unwrap();
        let music = root.path().join("drive");
        fs::create_dir(&music).unwrap();
        wav(&music.join("track.wav"));
        let cache = root.path().join("library.json");
        let thumbs = root.path().join("thumbs");
        let folders = vec![music.to_string_lossy().to_string()];
        scan_with_cache(None, folders.clone(), &cache, thumbs.clone()).unwrap();
        fs::rename(&music, root.path().join("disconnected")).unwrap();
        let result = scan_with_cache(None, folders, &cache, thumbs).unwrap();
        assert_eq!(result.songs.len(), 1);
        assert!(result.songs[0].missing);
        assert!(result.warnings[0].contains("unavailable"));
    }
    #[test]
    fn relocation_preserves_playlists_lyrics_and_play_counts() {
        let root = tempfile::tempdir().unwrap();
        let old = root.path().join("old.wav");
        wav(&old);
        let cache = root.path().join("library.json");
        scan_with_cache(
            None,
            vec![root.path().to_string_lossy().to_string()],
            &cache,
            root.path().join("thumbs"),
        )
        .unwrap();
        let new = root.path().join("new.wav");
        fs::rename(&old, &new).unwrap();
        let old_path = old.to_string_lossy().to_string();
        let new_path = new.to_string_lossy().to_string();
        let playlists = root.path().join("playlists");
        fs::create_dir(&playlists).unwrap();
        let playlist = crate::playlist::Playlist {
            name: "Test".into(),
            created_at: 1,
            tracks: vec![old_path.clone()],
        };
        crate::storage::write_json(&playlists.join("Test.json"), &playlist).unwrap();
        crate::storage::write_json(
            &root.path().join("lyrics.json"),
            &std::collections::HashMap::from([(old_path.clone(), "Lyrics")]),
        )
        .unwrap();
        crate::storage::write_json(
            &root.path().join("analytics.json"),
            &serde_json::json!({"counts": {old_path.clone(): 7}}),
        )
        .unwrap();
        let result = relocate_with_cache(old_path.clone(), new_path.clone(), &cache).unwrap();
        assert_eq!(result.path, new_path);
        assert!(!result.missing);
        let playlist: crate::playlist::Playlist =
            serde_json::from_str(&fs::read_to_string(playlists.join("Test.json")).unwrap())
                .unwrap();
        assert_eq!(playlist.tracks, vec![new_path.clone()]);
        let lyrics: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(root.path().join("lyrics.json")).unwrap())
                .unwrap();
        assert_eq!(lyrics[&new_path], "Lyrics");
        assert!(lyrics.get(&old_path).is_none());
        let stats: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(root.path().join("analytics.json")).unwrap())
                .unwrap();
        assert_eq!(stats["counts"][&new_path], 7);
        assert_eq!(read_library_cache(&cache).unwrap()[0].path, new_path);
    }
}

#[tauri::command]
pub fn get_spectrum(state: State<'_, AudioPlayer>) -> crate::spectrum::SpectrumFrame {
    state.spectrum()
}
