import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useModal } from '../hooks/useModal';


interface SettingsProps {
    path: string;
    seekInterval: number;
    onSave: (path: string, seekInterval: number) => void;
    scanMusic: () => void;
    onClearCache: () => void;
    loading: boolean;
    progress: { current: number; total: number } | null;
    cacheSize: number;
}

export function Settings({ path, seekInterval, onSave, scanMusic, onClearCache, loading, progress, cacheSize }: SettingsProps) {
    const { showConfirm } = useModal();
    const [localPath, setLocalPath] = useState(path);
    const [localSeek, setLocalSeek] = useState(seekInterval);
    const [themeMock, setThemeMock] = useState(true);
    const [version, setVersion] = useState("");

    useEffect(() => {
        getVersion().then(setVersion).catch(console.error);
    }, []);

    const handleSave = () => {
        onSave(localPath, localSeek);
    };

    const percent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="p-6 max-w-2xl mx-auto animate-fade-in w-full overflow-x-hidden pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Settings</h2>
                {(localPath !== path || localSeek !== seekInterval) && (
                    <button
                        onClick={handleSave}
                        className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all"
                    >
                        Save
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {/* Music Directory */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <label className="block text-xs text-white/40 mb-2 uppercase tracking-wide">Music Directory</label>
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-2">
                            <input
                                value={localPath}
                                onChange={(e) => setLocalPath(e.target.value)}
                                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
                                placeholder="/path/to/music"
                            />
                            <button
                                onClick={scanMusic}
                                disabled={loading}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M23 4v6h-6M1 20v-6h6" />
                                        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                    </svg>
                                )}
                                Sync
                            </button>
                        </div>

                        {loading && (
                            <div className="space-y-2 animate-fade-in">
                                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-white/40">
                                    <span>{progress ? `Syncing library...` : `Counting files...`}</span>
                                    <span>{progress ? `${progress.current} / ${progress.total}` : ''}</span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-white transition-all duration-300 relative"
                                        style={{ width: `${percent}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>
                                </div>
                                {progress && (
                                    <div className="text-right text-[10px] font-mono text-white/30">
                                        {percent}% Complete
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Seek Interval */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-white text-sm">Seek Interval</h4>
                            <p className="text-xs text-white/40">Skip forward/backward</p>
                        </div>
                        <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
                            {[5, 10, 15, 30].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => setLocalSeek(val)}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${localSeek === val
                                        ? 'bg-white text-black'
                                        : 'text-white/40 hover:text-white'
                                        }`}
                                >
                                    {val}s
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Dark Mode */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-white text-sm">Dark Mode</h4>
                            <p className="text-xs text-white/40">Always on</p>
                        </div>
                        <button
                            onClick={() => setThemeMock(!themeMock)}
                            className={`w-11 h-6 rounded-full relative transition-colors ${themeMock ? 'bg-white' : 'bg-white/20'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform shadow ${themeMock ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white'}`}></div>
                        </button>
                    </div>
                </div>

                {/* Clear Cache */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-white text-sm">Cache Management</h4>
                            <p className="text-xs text-white/40">Clear library data and thumbnails ({formatSize(cacheSize)})</p>
                        </div>
                        <button
                            onClick={async () => {
                                if (await showConfirm("Are you sure? This will reset your library metadata and requires a re-sync. Your music files will NOT be deleted.")) {
                                    onClearCache();
                                }
                            }}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
                        >
                            Clear Cache
                        </button>
                    </div>
                </div>

                {/* Version */}
                <p className="text-center text-white/20 text-xs pt-4">Luma v{version}</p>
            </div>
        </div>
    );
}
