import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Song, LoopMode, UsePlayerProps, UsePlayerReturn } from "../models";

export function usePlayer({ songs, seekInterval }: UsePlayerProps): UsePlayerReturn {
    const [queue, setQueue] = useState<Song[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isShuffle, setIsShuffle] = useState(false);
    const [loopMode, setLoopMode] = useState<LoopMode>("off");
    const [volume, setVolume] = useState(0.5);
    const progressIntervalRef = useRef<number | null>(null);
    const trackLoadedRef = useRef<boolean>(false);

    const currentSong = queue[currentIndex] || null;

    // Progress bar timer
    useEffect(() => {
        if (isPlaying && currentSong) {
            progressIntervalRef.current = window.setInterval(() => {
                setCurrentTime(prev => {
                    if (prev >= currentSong.duration_seconds) {
                        nextTrack(true);
                        return 0;
                    }
                    return prev + 1;
                });
            }, 1000);
        } else {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        }
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [isPlaying, currentSong]);

    async function playTrackInternal(trackPath: string) {
        try {
            await invoke("play_track", { path: trackPath });
            setCurrentTime(0);
            setIsPlaying(true);
            trackLoadedRef.current = true;
            await invoke("increment_play_count", { path: trackPath });
        } catch (e) {
            console.error("Failed to play", e);
        }
    }

    async function playSong(song: Song) {
        const idx = songs.findIndex(s => s.path === song.path);
        if (idx !== -1) {
            setQueue(songs);
            setCurrentIndex(idx);
            await playTrackInternal(song.path);
        } else {
            setQueue([song]);
            setCurrentIndex(0);
            await playTrackInternal(song.path);
        }
    }

    async function togglePlay() {
        try {
            if (!trackLoadedRef.current && currentSong) {
                await invoke("play_track", { path: currentSong.path });
                if (currentTime > 0) {
                    await invoke("seek_track", { seconds: Math.floor(currentTime) });
                }
                trackLoadedRef.current = true;
                setIsPlaying(true);
                return;
            }
            await invoke("toggle_playback");
            setIsPlaying(!isPlaying);
        } catch (e) {
            console.error("Toggle failed", e);
        }
    }

    function toggleShuffle() {
        setIsShuffle(!isShuffle);
    }

    function toggleLoop() {
        if (loopMode === "off") setLoopMode("all");
        else if (loopMode === "all") setLoopMode("one");
        else setLoopMode("off");
    }

    async function nextTrack(auto = false) {
        if (queue.length === 0) return;

        if (loopMode === "one" && auto) {
            await seekTo(0);
            return;
        }

        let nextIndex;
        if (isShuffle) {
            nextIndex = Math.floor(Math.random() * queue.length);
            if (queue.length > 1 && nextIndex === currentIndex) {
                nextIndex = (nextIndex + 1) % queue.length;
            }
        } else {
            nextIndex = currentIndex + 1;
        }

        if (nextIndex >= queue.length) {
            if (loopMode === "off") {
                if (auto) {
                    setIsPlaying(false);
                    await invoke("stop_playback");
                    setCurrentIndex(0);
                    setCurrentTime(0);
                    return;
                }
                nextIndex = 0;
            } else {
                nextIndex = 0;
            }
        }

        setCurrentIndex(nextIndex);
        await playTrackInternal(queue[nextIndex].path);
    }

    async function prevTrack() {
        if (queue.length === 0) return;
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) prevIndex = queue.length - 1;
        setCurrentIndex(prevIndex);
        await playTrackInternal(queue[prevIndex].path);
    }

    async function seekTo(time: number) {
        if (!currentSong) return;
        const newTime = Math.max(0, Math.min(time, currentSong.duration_seconds));
        await invoke("seek_track", { seconds: Math.floor(newTime) });
        setCurrentTime(Math.floor(newTime));
    }

    async function seekForward() {
        if (!currentSong) return;
        const newTime = Math.min(currentTime + seekInterval, currentSong.duration_seconds);
        await invoke("seek_track", { seconds: Math.floor(newTime) });
        setCurrentTime(Math.floor(newTime));
    }

    async function seekBackward() {
        if (!currentSong) return;
        const newTime = Math.max(currentTime - seekInterval, 0);
        await invoke("seek_track", { seconds: Math.floor(newTime) });
        setCurrentTime(Math.floor(newTime));
    }

    async function handleVolumeChange(newVolume: number) {
        const clamped = Math.max(0, Math.min(newVolume, 1));
        setVolume(clamped);
        try {
            await invoke("set_player_volume", { volume: clamped });
        } catch (e) {
            console.error("Failed to set volume:", e);
        }
    }

    async function handlePlayPlaylist(playlistSongs: Song[], startIndex = 0, shuffle = false) {
        if (playlistSongs.length === 0) return;

        setQueue(playlistSongs);
        setIsShuffle(shuffle);

        let idx = startIndex;
        if (shuffle && startIndex === 0) {
            idx = Math.floor(Math.random() * playlistSongs.length);
        }

        setCurrentIndex(idx);
        await playTrackInternal(playlistSongs[idx].path);
    }

    return {
        queue,
        setQueue,
        currentIndex,
        setCurrentIndex,
        currentSong,
        isPlaying,
        setIsPlaying,
        currentTime,
        setCurrentTime,
        volume,
        setVolume,
        isShuffle,
        setIsShuffle,
        loopMode,
        setLoopMode,
        trackLoadedRef,
        playTrackInternal,
        playSong,
        togglePlay,
        toggleShuffle,
        toggleLoop,
        nextTrack,
        prevTrack,
        seekTo,
        seekForward,
        seekBackward,
        handleVolumeChange,
        handlePlayPlaylist,
    };
}
