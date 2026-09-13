export interface AudioSettings {
    gapless: boolean;
    crossfade_seconds: number;
    replay_gain: boolean;
    eq_low: number;
    eq_mid: number;
    eq_high: number;
}
export interface AppSettings {
    music_directory: string;
    music_directories: string[];
    watch_library: boolean;
    theme: string;
    seek_interval: number;
    audio: AudioSettings;
}
