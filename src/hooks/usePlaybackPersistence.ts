import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { UsePlaybackPersistenceProps } from "../models";

import { PlaybackStorage } from "../services/playbackStorage";

export function usePlaybackPersistence({
    queue,
    currentIndex,
    currentTime,
    volume,
    isShuffle,
    loopMode,
    isPlaying,
    setQueue,
    setCurrentIndex,
    setCurrentTime,
    setVolume,
    setIsShuffle,
    setLoopMode,
}: UsePlaybackPersistenceProps) {
    const restored = useRef(false);
    const storage = useRef<PlaybackStorage | null>(null);
    const getStorage = () => storage.current ?? (storage.current = new PlaybackStorage());
    const stateRef = useRef({ queue, currentIndex, currentTime, volume, isShuffle, loopMode, isPlaying });

    useEffect(() => {
        stateRef.current = { queue, currentIndex, currentTime, volume, isShuffle, loopMode, isPlaying };
    }, [queue, currentIndex, currentTime, volume, isShuffle, loopMode, isPlaying]);

    const saveState = async () => {
        const current = stateRef.current;
        if (!restored.current) return;

        try {
            await getStorage().save(current);
        } catch (e) {
            console.error("Failed to save playback state", e);
        }
    };
    useEffect(() => {
        let active = true;
        async function restore() {
            try {
                const savedState = await getStorage().restore();
                // A slow restore must not replace a queue the user has already started.
                if (active && savedState && stateRef.current.queue.length === 0 && stateRef.current.currentIndex === -1) {
                    const savedQueue = Array.isArray(savedState.queue) ? savedState.queue.filter(song => song && typeof song.path === 'string') : [];
                    const savedVolume = Math.max(0, Math.min(savedState.volume ?? 0.5, 1));
                    setQueue(savedQueue);
                    setCurrentIndex(savedQueue.length ? Math.max(0, Math.min(savedState.currentIndex || 0, savedQueue.length - 1)) : -1);
                    setCurrentTime(savedQueue.length ? Math.max(0, savedState.currentTime || 0) : 0);
                    setVolume(savedVolume);
                    setIsShuffle(Boolean(savedState.isShuffle));
                    setLoopMode(["off", "all", "one"].includes(savedState.loopMode) ? savedState.loopMode : "off");
                    await invoke("set_player_volume", { volume: savedVolume });
                }
            } catch (e) {
                console.error("Failed to restore playback state", e);
            } finally { if (active) restored.current = true; }
        }
        void restore();
        return () => { active = false; };
    }, []);

    // Effect 1: Critical state changes (song, queue, volume, etc.) -> Save debounced (500ms)
    useEffect(() => {
        const timeoutId = setTimeout(saveState, 500);
        return () => clearTimeout(timeoutId);
    }, [queue, currentIndex, volume, isShuffle, loopMode]);

    // Effect 2: Playback time -> Save periodically (e.g. every 5s) or on pause
    useEffect(() => {
        if (!isPlaying) {
            saveState();
            return;
        }

        // Periodic checkpoints cover crashes; the exit handler saves the final position.
        const intervalId = setInterval(saveState, 5000);
        return () => clearInterval(intervalId);
    }, [isPlaying]); // Re-setup interval when play state changes. 

    return { saveState };
}
