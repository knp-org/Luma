import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Song, AppSettings, UseLibraryReturn } from "../models";
import { useModal } from "./useModal";

export function useLibrary(): UseLibraryReturn {
    const { showAlert } = useModal();
    const [songs, setSongs] = useState<Song[]>([]);
    const [loading, setLoading] = useState(false);
    const [path, setPath] = useState("");
    const [seekInterval, setSeekInterval] = useState(10);
    const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
    const [cacheSize, setCacheSize] = useState<number>(0);

    useEffect(() => {
        async function init() {
            const settings = await invoke<AppSettings>("load_settings");
            setPath(settings.music_directory);
            setSeekInterval(settings.seek_interval || 10);

            setLoading(true);
            try {
                const cachedSongs = await invoke<Song[]>("get_cached_library");
                if (cachedSongs && cachedSongs.length > 0) {
                    console.log("Loaded library from cache:", cachedSongs.length, "songs");
                    setSongs(cachedSongs);
                } else {
                    console.log("Cache empty, scanning...");
                    await scanMusic(settings.music_directory);
                }
            } catch (e) {
                console.error("Failed to load cache", e);
                await scanMusic(settings.music_directory);
            }
            setLoading(false);
        }
        init();
    }, []);

    useEffect(() => {
        let unlisten: any;
        const setup = async () => {
            unlisten = await listen<{ current: number; total: number }>("sync-progress", (event) => {
                setSyncProgress(event.payload);
            });
        };
        setup();
        refreshCacheSize();
        return () => { if (unlisten) unlisten(); };
    }, []);

    async function refreshCacheSize() {
        try {
            const size = await invoke<number>("get_cache_size");
            setCacheSize(size);
        } catch (e) {
            console.error("Failed to get cache size", e);
        }
    }

    async function scanMusic(overridePath?: string) {
        setLoading(true);
        setSyncProgress(null);
        try {
            const result = await invoke<Song[]>("scan_music_dir", { directory: overridePath || path });
            setSongs(result);
        } catch (e) {
            console.error(e);
            showAlert("Error scanning: " + e, "Error");
        }
        setLoading(false);
        setSyncProgress(null);
        refreshCacheSize();
    }

    async function handleClearCache() {
        try {
            await invoke("clear_cache");
            setSongs([]);
        } catch (e) {
            console.error(e);
            showAlert("Failed to clear cache: " + e, "Error");
        }
        refreshCacheSize();
    }

    async function saveSettings(newPath: string, newSeekInterval: number) {
        setPath(newPath);
        setSeekInterval(newSeekInterval);
        await invoke("save_settings", {
            settings: {
                music_directory: newPath,
                theme: "dark",
                seek_interval: newSeekInterval
            }
        });
    }

    return {
        songs,
        setSongs,
        loading,
        path,
        setPath,
        seekInterval,
        setSeekInterval,
        syncProgress,
        cacheSize,
        scanMusic,
        handleClearCache,
        refreshCacheSize,
        saveSettings,
    };
}
