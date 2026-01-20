// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub mod commands;
pub mod player;
pub mod playlist;
pub mod settings;
pub mod lyrics;
pub mod analytics;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(player::AudioPlayer::new())
        .invoke_handler(tauri::generate_handler![
            greet, 
            commands::scan_music_dir,
            commands::get_cached_library,
            commands::get_song_art,
            commands::get_thumbnail,
            commands::clear_cache,
            commands::get_cache_size,
            commands::play_track,
            commands::toggle_playback,
            commands::stop_playback,
            commands::seek_track,
            commands::set_player_volume,
            playlist::create_playlist,
            playlist::get_playlists,
            playlist::add_to_playlist,
            playlist::remove_from_playlist,
            playlist::delete_playlist,
            settings::load_settings,
            settings::save_settings,
            lyrics::get_song_lyrics,
            lyrics::save_song_lyrics,
            lyrics::delete_song_lyrics,
            lyrics::fetch_lyrics_online,
            analytics::increment_play_count,
            analytics::get_play_stats,
            commands::update_song_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
