import { Playlist } from "./Playlist";
import { Song } from "./Song";

export interface UsePlaylistsProps {
    currentSong: Song | null;
}

export interface UsePlaylistsReturn {
    playlists: Playlist[];
    loadPlaylists: () => Promise<void>;
    addToPlaylist: (playlistName: string, songPath: string, keepOpen?: boolean) => Promise<void>;
    isFavorite: boolean;
    handleToggleFavorite: () => Promise<void>;
    menuOpenFor: string | null;
    setMenuOpenFor: React.Dispatch<React.SetStateAction<string | null>>;
}
