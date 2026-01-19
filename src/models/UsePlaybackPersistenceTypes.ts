import { Song } from "./Song";
import { LoopMode } from "./LoopMode";

export interface UsePlaybackPersistenceProps {
    queue: Song[];
    currentIndex: number;
    currentTime: number;
    volume: number;
    isShuffle: boolean;
    loopMode: LoopMode;
    isPlaying: boolean;
    setQueue: React.Dispatch<React.SetStateAction<Song[]>>;
    setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
    setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
    setVolume: React.Dispatch<React.SetStateAction<number>>;
    setIsShuffle: React.Dispatch<React.SetStateAction<boolean>>;
    setLoopMode: React.Dispatch<React.SetStateAction<LoopMode>>;
}
