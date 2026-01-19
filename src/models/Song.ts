export interface Song {
    path: string;
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    track_number?: number;
    year?: number;
    duration_seconds: number;
    bitrate?: number;        // kbps
    sample_rate?: number;    // Hz
    bits_per_sample?: number;
    channels?: number;
    file_size_bytes: number;
    has_album_art: boolean;
    cover_handle?: string;
    lyrics?: string;
}
