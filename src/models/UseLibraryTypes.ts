import { Song } from "./Song";

export interface UseLibraryReturn {
    songs: Song[];
    setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
    loading: boolean;
    path: string;
    setPath: React.Dispatch<React.SetStateAction<string>>;
    seekInterval: number;
    setSeekInterval: React.Dispatch<React.SetStateAction<number>>;
    syncProgress: { current: number; total: number } | null;
    cacheSize: number;
    scanMusic: (overridePath?: string) => Promise<void>;
    handleClearCache: () => Promise<void>;
    refreshCacheSize: () => Promise<void>;
    saveSettings: (newPath: string, newSeekInterval: number) => Promise<void>;
}
