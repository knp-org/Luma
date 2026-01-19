export interface PlaybackState {
    queue: import("./Song").Song[];
    currentIndex: number;
    currentTime: number;
    volume: number;
    isShuffle: boolean;
    loopMode: import("./LoopMode").LoopMode;
    isPlaying: boolean;
}
