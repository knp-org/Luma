import { Song } from "./Song";
import { LoopMode } from "./LoopMode";

export interface UsePlayerProps {
    songs: Song[];
    seekInterval: number;
}

export interface UsePlayerReturn {
    queue: Song[];
    setQueue: React.Dispatch<React.SetStateAction<Song[]>>;
    currentIndex: number;
    setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
    currentSong: Song | null;
    isPlaying: boolean;
    setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    currentTime: number;
    setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
    volume: number;
    setVolume: React.Dispatch<React.SetStateAction<number>>;
    isShuffle: boolean;
    setIsShuffle: React.Dispatch<React.SetStateAction<boolean>>;
    loopMode: LoopMode;
    setLoopMode: React.Dispatch<React.SetStateAction<LoopMode>>;
    trackLoadedRef: React.MutableRefObject<boolean>;
    playTrackInternal: (trackPath: string) => Promise<void>;
    playSong: (song: Song) => Promise<void>;
    togglePlay: () => Promise<void>;
    toggleShuffle: () => void;
    toggleLoop: () => void;
    nextTrack: (auto?: boolean) => Promise<void>;
    prevTrack: () => Promise<void>;
    seekTo: (time: number) => Promise<void>;
    seekForward: () => Promise<void>;
    seekBackward: () => Promise<void>;
    handleVolumeChange: (newVolume: number) => Promise<void>;
    handlePlayPlaylist: (playlistSongs: Song[], startIndex?: number, shuffle?: boolean) => Promise<void>;
}
