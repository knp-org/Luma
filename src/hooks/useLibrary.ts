import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Song, AppSettings } from "../models";

interface ScanResult {
  songs: Song[];
  warnings: string[];
}
export const defaultSettings: AppSettings = {
  music_directory: "",
  music_directories: [],
  watch_library: true,
  theme: "dark",
  seek_interval: 10,
  audio: {
    gapless: true,
    crossfade_seconds: 0,
    replay_gain: false,
    eq_low: 0,
    eq_mid: 0,
    eq_high: 0,
  },
};
export function useLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [cacheSize, setCacheSize] = useState(0);
  const latest = useRef(settings);
  latest.current = settings;
  const scanning = useRef(false);
  async function refreshCacheSize() {
    try {
      setCacheSize(await invoke<number>("get_cache_size"));
    } catch (e) {
      console.error(e);
    }
  }
  async function scanMusic(directories?: string[]) {
    if (scanning.current) return;
    scanning.current = true;
    setLoading(true);
    setSyncProgress(null);
    try {
      const result = await invoke<ScanResult>("scan_music_dir", {
        directories: directories ?? latest.current.music_directories,
      });
      setSongs(result.songs);
      setWarnings(result.warnings);
    } catch (e) {
      setWarnings([String(e)]);
      throw e;
    } finally {
      scanning.current = false;
      setLoading(false);
      setSyncProgress(null);
      void refreshCacheSize();
    }
  }
  useEffect(() => {
    let active = true;
    const listeners = [
      listen<{ current: number; total: number }>("sync-progress", (event) => {
        if (active) setSyncProgress(event.payload);
      }),
      listen<ScanResult>("library-updated", (event) => {
        if (active) {
          setSongs(event.payload.songs);
          setWarnings(event.payload.warnings);
          setSyncProgress(null);
          void refreshCacheSize();
        }
      }),
      listen<string>("library-error", (event) => {
        if (active) setWarnings([event.payload]);
      }),
    ];
    void (async () => {
      try {
        const saved = await invoke<AppSettings>("load_settings");
        if (!active) return;
        const normalized = {
          ...saved,
          music_directories: saved.music_directories.length
            ? saved.music_directories
            : [saved.music_directory],
        };
        latest.current = normalized;
        setSettings(normalized);
        const cached = await invoke<Song[]>("get_cached_library");
        if (!active) return;
        if (cached.length) setSongs(cached);
        else await scanMusic(normalized.music_directories);
        void refreshCacheSize();
      } catch (e) {
        if (active) setWarnings([String(e)]);
      }
    })();
    return () => {
      active = false;
      listeners.forEach((p) =>
        p.then((unlisten) => unlisten()).catch(console.error),
      );
    };
  }, []);
  async function saveSettings(value: AppSettings) {
    const clean = {
      ...value,
      music_directories: [
        ...new Set(
          value.music_directories.map((path) => path.trim()).filter(Boolean),
        ),
      ],
    };
    if (!clean.music_directories.length)
      throw new Error("Add at least one music folder.");
    clean.music_directory = clean.music_directories[0];
    await invoke("save_settings", { settings: clean });
    await invoke("set_audio_effects", { settings: clean.audio });
    latest.current = clean;
    setSettings(clean);
    await scanMusic(clean.music_directories);
  }
  async function handleClearCache() {
    await invoke("clear_cache");
    await scanMusic();
  }
  async function locateMissing(oldPath: string, newPath: string) {
    const updated = await invoke<Song>("relocate_music_file", {
      oldPath,
      newPath,
    });
    window.dispatchEvent(
      new CustomEvent("song-relocated", { detail: { oldPath, song: updated } }),
    );
    setSongs(await invoke<Song[]>("get_cached_library"));
    window.dispatchEvent(new Event("playlists-changed"));
  }
  return {
    songs,
    setSongs,
    settings,
    loading,
    warnings,
    syncProgress,
    cacheSize,
    scanMusic,
    handleClearCache,
    saveSettings,
    locateMissing,
  };
}
