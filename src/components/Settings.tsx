import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useModal } from '../hooks/useModal';
import { GlassCard, GlassButton, GlassInput, GlassProgress, GlassHeading, GlassText, GlassSpinner } from '@knp-org/liquid-glass-ui';
import { IconSync } from '@knp-org/liquid-glass-ui';


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
                <GlassHeading as="h2" className="text-2xl font-bold text-white">Settings</GlassHeading>
                {(localPath !== path || localSeek !== seekInterval) && (
                    <GlassButton
                        onClick={handleSave}
                        variant="primary"
                        shape="pill"
                    >
                        Save
                    </GlassButton>
                )}
            </div>

            <div className="space-y-4">
                {/* Music Directory */}
                <GlassCard className="p-4">
                    <label className="block text-xs text-white/40 mb-2 uppercase tracking-wide">Music Directory</label>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-stretch gap-2">
                            <GlassInput
                                value={localPath}
                                onChange={(e) => setLocalPath(e.target.value)}
                                className="flex-1 !h-11 !py-0 !text-sm"
                                placeholder="/path/to/music"
                            />
                            <GlassButton
                                onClick={scanMusic}
                                disabled={loading}
                                className="!h-11 !px-5 !text-sm shrink-0 whitespace-nowrap"
                            >
                                {loading ? (
                                    <GlassSpinner size={16} />
                                ) : (
                                    <IconSync size={16} />
                                )}
                                Sync
                            </GlassButton>
                        </div>

                        {loading && (
                            <div className="space-y-2 animate-fade-in">
                                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-white/40">
                                    <span>{progress ? `Syncing library...` : `Counting files...`}</span>
                                    <span>{progress ? `${progress.current} / ${progress.total}` : ''}</span>
                                </div>
                                <GlassProgress progress={percent} />
                                {progress && (
                                    <div className="text-right text-[10px] font-mono text-white/30">
                                        {percent}% Complete
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </GlassCard>

                {/* Seek Interval */}
                <GlassCard className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <GlassHeading as="h4" className="font-medium text-white text-sm">Seek Interval</GlassHeading>
                            <GlassText as="p" className="text-xs text-white/40">Skip forward/backward</GlassText>
                        </div>
                        {/* Plain <button>: the library's .glass-btn-ghost rule is unlayered CSS,
                            which outranks Tailwind's layered utilities and wipes out the
                            padding/background/font-size needed for the selected state. */}
                        <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
                            {[5, 10, 15, 30].map((val) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setLocalSeek(val)}
                                    aria-pressed={localSeek === val}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${localSeek === val
                                        ? 'bg-white text-black shadow-sm'
                                        : 'text-white/40 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {val}s
                                </button>
                            ))}
                        </div>
                    </div>
                </GlassCard>

                {/* Clear Cache */}
                <GlassCard className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <GlassHeading as="h4" className="font-medium text-white text-sm">Cache Management</GlassHeading>
                            <GlassText as="p" className="text-xs text-white/40">Clear library data and thumbnails ({formatSize(cacheSize)})</GlassText>
                        </div>
                        <GlassButton
                            variant="danger"
                            onClick={async () => {
                                if (await showConfirm("Are you sure? This will reset your library metadata and requires a re-sync. Your music files will NOT be deleted.")) {
                                    onClearCache();
                                }
                            }}
                        >
                            Clear Cache
                        </GlassButton>
                    </div>
                </GlassCard>

                {/* Version */}
                <GlassText as="p" className="text-center text-white/20 text-xs pt-4">Luma v{version}</GlassText>
            </div>
        </div>
    );
}
