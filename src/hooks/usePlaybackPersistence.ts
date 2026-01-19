import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { PlaybackState, UsePlaybackPersistenceProps } from "../models";

const PLAYBACK_STATE_KEY = "luma_playback_state";

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
    const stateRef = useRef({ queue, currentIndex, currentTime, volume, isShuffle, loopMode, isPlaying });

    useEffect(() => {
        stateRef.current = { queue, currentIndex, currentTime, volume, isShuffle, loopMode, isPlaying };
    }, [queue, currentIndex, currentTime, volume, isShuffle, loopMode, isPlaying]);

    const saveState = async () => {
        const current = stateRef.current;
        if (current.queue.length === 0) return;

        try {
            const store = await load("playback-state.json");
            await store.set(PLAYBACK_STATE_KEY, current);
            await store.save();
        } catch (e) {
            console.error("Failed to save playback state", e);
        }
    };
    useEffect(() => {
        async function restore() {
            try {
                const store = await load("playback-state.json");
                const savedState = await store.get<PlaybackState>(PLAYBACK_STATE_KEY);
                if (savedState && savedState.queue && savedState.queue.length > 0) {
                    setQueue(savedState.queue);
                    setCurrentIndex(savedState.currentIndex);
                    setCurrentTime(savedState.currentTime);
                    setVolume(savedState.volume);
                    setIsShuffle(savedState.isShuffle);
                    setLoopMode(savedState.loopMode);
                    await invoke("set_player_volume", { volume: savedState.volume });
                    console.log("Restored playback state", savedState);
                }
            } catch (e) {
                console.error("Failed to restore playback state", e);
            }
        }
        restore();
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

        // While playing, save every 5 seconds (not on every second update)
        // actually, we can just let the exit handler take care of the final save, 
        // but a periodic save is good in case of crash.
        const intervalId = setInterval(saveState, 5000);
        return () => clearInterval(intervalId);
    }, [isPlaying]); // Re-setup interval when play state changes. 

    // Note: We don't include `currentTime` in dependencies for Effect 1 or 2 to avoid rapid firing.
    // However, `saveState` closes over the current scope variables. 
    // This is a classic React closure trap if `saveState` isn't recreated.
    // But if we separate the definition inside effects, code is duplicated.
    // If we put `saveState` in `useCallback` with all deps, it changes every second (due to currentTime), defeating the purpose.

    // SOLUTION: Use a Ref to hold the latest state, so `saveState` doesn't need to change.

    return { saveState };
}
