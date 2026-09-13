import { QueueEditor } from './QueueEditor';
import { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Song, LoopMode } from '../types';
import { AlbumArt, useSongArt } from './AlbumArt';
import { AudioVisualizer, readVisualizerPreference } from './AudioVisualizer';
import { GlassButton, GlassCard, GlassHeading, GlassText, GlassTextarea, GlassAlert, GlassEmptyState, GlassBadge } from '@knp-org/liquid-glass-ui';
import { parseLyrics, getCurrentLineIndex } from '../utils/lrcParser';
import { PlaybackControls } from './PlaybackControls';
import { SeekSlider } from './PlayerSlider';
import { PlayerPanel } from './PlayerPanel';
import { IconFavorites, IconMusicNote, IconEdit, IconSpinner, IconDownload, IconArrowLeft, IconQueue, IconAnalytics, IconMinimize } from '@knp-org/liquid-glass-ui';

interface PlayerPageProps {
    currentSong: Song;
    currentTime: number;
    isPlaying: boolean;
    isShuffle: boolean;
    onClose: () => void;
    onOpenPill: () => void;
    pillBusy: boolean;
    onPrevTrack: () => void;
    onNextTrack: () => void;
    onTogglePlay: () => void;
    onToggleShuffle: () => void;
    onSeek: (time: number) => void;
    loopMode: LoopMode;
    onToggleLoop: () => void;
    queue: Song[];
    currentIndex: number;
    onPlayIndex: (index: number) => void;
    onMoveQueue: (from: number, to: number) => void;
    onRemoveQueue: (index: number) => void;
    onQueueSaved: () => Promise<void>;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    onSeekForward: () => void;
    onSeekBackward: () => void;
    sleepTimer: {
        active: boolean;
        endTime: number;
        action: 'stop' | 'quit';
        originalDuration?: number;
    } | null;
    onSetSleepTimer: (minutes: number, action: 'stop' | 'quit') => void;
    onCancelSleepTimer: () => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
}

export function PlayerPage({
    currentSong,
    currentTime,
    isPlaying,
    isShuffle,
    onClose,
    onOpenPill,
    pillBusy,
    isFavorite,
    onToggleFavorite,
    onPrevTrack,
    onNextTrack,
    onTogglePlay,
    onToggleShuffle,
    onSeek,
    onSeekForward,
    onSeekBackward,
    loopMode,
    onToggleLoop,
    queue,
    currentIndex,
    onPlayIndex,
    onMoveQueue,
    onRemoveQueue,
    onQueueSaved,
    sleepTimer,
    onSetSleepTimer,
    onCancelSleepTimer,
    volume,
    onVolumeChange,
}: PlayerPageProps) {
    const artSrc = useSongArt(currentSong);
    const currentPath = useRef(currentSong.path);
    currentPath.current = currentSong.path;

    const [panel, setPanel] = useState<'queue' | 'lyrics' | null>(null);
    const [showVisualizer, setShowVisualizer] = useState(readVisualizerPreference);

    useEffect(() => {
        try {
            localStorage.setItem('luma.visualizer', JSON.stringify({ enabled: showVisualizer }));
        } catch {
            // The toggle still works when local storage is unavailable.
        }
    }, [showVisualizer]);

    // Lyrics state
    const [userLyrics, setUserLyrics] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const [saving, setSaving] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null);
    const lyricsContainerRef = useRef<HTMLDivElement>(null);

    // Auto-dismiss toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Escape closes the topmost open panel, then the player itself
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key !== 'Escape') return;
            if (isEditing && panel === 'lyrics') { setIsEditing(false); return; }
            if (panel) { setPanel(null); return; }
            onClose();
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isEditing, panel, onClose]);

    useEffect(() => {
        let active = true;
        setUserLyrics(null);
        async function loadUserLyrics() {
            try {
                const lyrics = await invoke<string | null>('get_song_lyrics', { songPath: currentSong.path });
                if (active) setUserLyrics(lyrics);
            } catch (e) {
                console.error('Failed to load lyrics:', e);
            }
        }
        loadUserLyrics();
        setIsEditing(false);
        return () => { active = false; };
    }, [currentSong.path]);

    const displayLyrics = currentSong.lyrics || userLyrics;

    const parsedLyrics = useMemo(() => {
        if (!displayLyrics) return null;
        return parseLyrics(displayLyrics);
    }, [displayLyrics]);

    const currentLineIndex = useMemo(() => {
        if (!parsedLyrics?.isSynced) return -1;
        return getCurrentLineIndex(parsedLyrics.lines, currentTime);
    }, [parsedLyrics, currentTime]);

    const prevSongs = useMemo(() => {
        const list: { song: Song; index: number; offset: number }[] = [];
        for (let i = 3; i >= 1; i--) {
            const idx = currentIndex - i;
            if (idx >= 0 && queue[idx]) {
                list.push({ song: queue[idx], index: idx, offset: -i });
            }
        }
        return list;
    }, [queue, currentIndex]);

    const nextSongs = useMemo(() => {
        const list: { song: Song; index: number; offset: number }[] = [];
        for (let i = 1; i <= 3; i++) {
            const idx = currentIndex + i;
            if (idx < queue.length && queue[idx]) {
                list.push({ song: queue[idx], index: idx, offset: i });
            }
        }
        return list;
    }, [queue, currentIndex]);

    useEffect(() => {
        if (currentLineIndex < 0 || !lyricsContainerRef.current || isEditing) return;
        const container = lyricsContainerRef.current;
        const activeElement = container.querySelector<HTMLElement>(`[data-line-index="${currentLineIndex}"]`);
        if (activeElement) {
            // Scroll the lyrics container only — scrollIntoView also scrolls every
            // scrollable ancestor, which yanked the whole player content upwards.
            const top = activeElement.offsetTop - container.clientHeight / 2 + activeElement.offsetHeight / 2;
            container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
        }
    }, [currentLineIndex, isEditing, panel]);

    async function saveLyrics() {
        setSaving(true);
        try {
            await invoke('save_song_lyrics', { songPath: currentSong.path, lyrics: editText });
            if (currentPath.current === currentSong.path) setUserLyrics(editText.trim() || null);
            setIsEditing(false);
        } catch (e) {
            console.error('Failed to save lyrics:', e);
        }
        setSaving(false);
    }

    return (
        <div data-player-controls data-player-page role="dialog" aria-label="Now playing" aria-modal="true"
            onKeyDown={event => {
                if (event.key !== 'Tab' || event.defaultPrevented) return;
                const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length);
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }} className="fixed inset-0 z-[2000] bg-neutral-950 flex flex-col animate-fade-in overflow-hidden">
            {/* Background */}
            {artSrc && (
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl scale-110"
                    style={{ backgroundImage: `url(${artSrc})` }}
                ></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90"></div>

            {/* Header */}
            <div className="relative z-50 flex items-center px-6 pt-10 pb-3 pr-[160px]">
                <div data-tauri-drag-region className="absolute inset-0 z-0"></div>
                <GlassButton variant="ghost" onClick={onClose} aria-label="Back to library" autoFocus className="p-2 hover:bg-white/10 rounded-full transition-colors relative z-10">
                    <IconArrowLeft size={24} />
                </GlassButton>
                <div className="absolute left-1/2 -translate-x-1/2 text-sm text-white/65 font-medium z-10 pointer-events-none">Now Playing</div>
            </div>

            {/* Main Layout */}
            <div className="luma-player-layout flex-1 flex relative z-10 overflow-hidden items-center justify-center" data-panel-open={Boolean(panel)}>
                {/* Player Content (Fixed Center — never shifts when drawers open) */}
                <div className="luma-player-content absolute inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-3xl flex flex-col items-center px-4 sm:px-8 z-10 overflow-y-auto overflow-x-hidden scrollbar-hidden py-3">
                    {/* Album Art Stack Carousel (Prev 3, Active, Next 3) */}
                    <div className="relative w-full flex items-center justify-center mb-3 h-[clamp(11rem,30vh,17rem)] select-none overflow-visible flex-shrink-0">
                        {/* Previous 3 Songs Stacked (Left) */}
                        {prevSongs.map(({ song, index, offset }) => {
                            const absOffset = Math.abs(offset);
                            const translateX = offset * 42;
                            const scale = 1 - absOffset * 0.12;
                            const blur = absOffset === 3 ? 'blur-md' : absOffset === 2 ? 'blur-sm' : 'blur-[2px]';
                            const opacity = absOffset === 3 ? 'opacity-30' : absOffset === 2 ? 'opacity-50' : 'opacity-75';
                            const zIndex = 10 - absOffset;

                            return (
                                <GlassCard
                                    key={`prev-${index}`}
                                    onClick={() => onPlayIndex(index)}
                                    role="button" tabIndex={0}
                                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPlayIndex(index); } }}
                                    style={{
                                        transform: `translateX(${translateX}%) scale(${scale})`,
                                        zIndex: zIndex,
                                    }}
                                    className={`!p-0 absolute w-[clamp(11rem,30vh,17rem)] h-[clamp(11rem,30vh,17rem)] rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-xl cursor-pointer transform-gpu will-change-transform transition-all duration-500 ease-out hover:opacity-100 hover:scale-105 hover:blur-none ${blur} ${opacity}`}
                                    title={`Previous: ${song.title || 'Track'}`}
                                >
                                    <AlbumArt song={song} className="w-full h-full object-cover" />
                                </GlassCard>
                            );
                        })}

                        {/* Current Active Song (Center) */}
                        <div className="relative z-20 w-[clamp(11rem,30vh,17rem)] h-[clamp(11rem,30vh,17rem)] transform-gpu transition-transform duration-500 ease-out hover:scale-105">
                            <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/20 flex items-center justify-center bg-black/60">
                                <AlbumArt song={currentSong} className="w-full h-full" placeholderContent={<div className="text-8xl">💿</div>} useOriginal={true} objectFit="contain" smooth={true} />
                            </div>
                        </div>

                        {/* Next 3 Songs Stacked (Right) */}
                        {nextSongs.map(({ song, index, offset }) => {
                            const absOffset = Math.abs(offset);
                            const translateX = offset * 42;
                            const scale = 1 - absOffset * 0.12;
                            const blur = absOffset === 3 ? 'blur-md' : absOffset === 2 ? 'blur-sm' : 'blur-[2px]';
                            const opacity = absOffset === 3 ? 'opacity-30' : absOffset === 2 ? 'opacity-50' : 'opacity-75';
                            const zIndex = 10 - absOffset;

                            return (
                                <GlassCard
                                    key={`next-${index}`}
                                    onClick={() => onPlayIndex(index)}
                                    role="button" tabIndex={0}
                                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPlayIndex(index); } }}
                                    style={{
                                        transform: `translateX(${translateX}%) scale(${scale})`,
                                        zIndex: zIndex,
                                    }}
                                    className={`!p-0 absolute w-[clamp(11rem,30vh,17rem)] h-[clamp(11rem,30vh,17rem)] rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-xl cursor-pointer transform-gpu will-change-transform transition-all duration-500 ease-out hover:opacity-100 hover:scale-105 hover:blur-none ${blur} ${opacity}`}
                                    title={`Next: ${song.title || 'Track'}`}
                                >
                                    <AlbumArt song={song} className="w-full h-full object-cover" />
                                </GlassCard>
                            );
                        })}
                    </div>
                    {showVisualizer && (
                        <AudioVisualizer isPlaying={isPlaying} volume={volume} trackKey={currentSong.path} />
                    )}
                    <div className="text-center mb-3 max-w-md w-full px-4 flex-shrink-0">
                        <div className="flex items-center justify-center gap-4 mb-1">
                            <GlassHeading as="h1" className="text-xl sm:text-2xl md:text-3xl font-bold text-white truncate max-w-[80%]">{currentSong.title || "Unknown Title"}</GlassHeading>
                            <GlassButton variant="ghost"
                                onClick={onToggleFavorite}
                                className={`p-2 transition-colors ${isFavorite ? 'text-red-500' : 'text-white/60 hover:text-white'}`}
                                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={isFavorite}
                            >
                                <IconFavorites size={24} fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isFavorite ? "0" : "2"} />
                            </GlassButton>
                        </div>
                        <GlassText as="p" className="text-base sm:text-lg text-white/60 truncate">{currentSong.artist || "Unknown Artist"}</GlassText>
                        <GlassText as="p" className="text-xs sm:text-sm text-white/65 truncate mt-1">{currentSong.album || "Unknown Album"}</GlassText>
                    </div>
                    <div className="w-full max-w-lg flex-shrink-0">
                        <SeekSlider key={currentSong.path} value={currentTime} duration={currentSong.duration_seconds} onSeek={onSeek} />
                    </div>
                    <PlaybackControls isPlaying={isPlaying} isShuffle={isShuffle} loopMode={loopMode}
                        onPrevTrack={onPrevTrack} onNextTrack={onNextTrack} onTogglePlay={onTogglePlay}
                        onToggleShuffle={onToggleShuffle} onToggleLoop={onToggleLoop}
                        onSeekForward={onSeekForward} onSeekBackward={onSeekBackward}
                        volume={volume} onVolumeChange={onVolumeChange} sleepTimer={sleepTimer}
                        onSetSleepTimer={onSetSleepTimer} onCancelSleepTimer={onCancelSleepTimer}
                        duration={currentSong.duration_seconds} currentTime={currentTime} />

                    {/* Panel Toggle Buttons */}
                    <div className="flex items-center justify-center flex-wrap gap-3 mt-1 flex-shrink-0">
                        <GlassButton type="button" variant="ghost" onClick={onOpenPill} disabled={pillBusy} aria-label="Open floating pill player" title="Floating pill player">
                            <IconMinimize size={16} /> Pill mode
                        </GlassButton>
                        <GlassButton variant="ghost"
                            onClick={() => setPanel(panel === 'queue' ? null : 'queue')}
                            aria-expanded={panel === 'queue'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${panel === 'queue' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'}`}
                            title="Toggle queue"
                        >
                            <IconQueue size={16} />
                            <span className="text-xs font-medium">Queue</span>
                        </GlassButton>
                        <GlassButton variant="ghost"
                            onClick={() => setPanel(panel === 'lyrics' ? null : 'lyrics')}
                            aria-expanded={panel === 'lyrics'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${panel === 'lyrics' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'}`}
                            title="Toggle lyrics"
                        >
                            <IconMusicNote size={16} />
                            <span className="text-xs font-medium">Lyrics</span>
                        </GlassButton>
                        <GlassButton variant="ghost"
                            onClick={() => setShowVisualizer(value => !value)}
                            aria-pressed={showVisualizer}
                            aria-label="Toggle visualizer"
                            aria-controls={showVisualizer ? 'player-visualizer' : undefined}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${showVisualizer ? 'bg-white/20 text-white' : 'bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'}`}
                            title={showVisualizer ? 'Turn visualizer off' : 'Turn visualizer on'}
                        >
                            <IconAnalytics size={16} />
                            <span className="text-xs font-medium">Visualizer</span>
                        </GlassButton>
                    </div>
                </div>

                {panel && <PlayerPanel tab={panel} onTabChange={setPanel} onClose={() => { setIsEditing(false); setPanel(null); }}>
                    {panel === 'queue' ? <>
                        <p className="luma-panel-description">{queue.length} {queue.length === 1 ? 'track' : 'tracks'} in your queue</p>
                        <QueueEditor queue={queue} currentIndex={currentIndex} onPlayIndex={onPlayIndex} onMove={onMoveQueue} onRemove={onRemoveQueue} onSaved={onQueueSaved} />
                    </> : <>
                        {!currentSong.lyrics && <div className="luma-lyrics-actions">
                            <GlassButton variant="ghost" onClick={() => { setEditText(userLyrics || ''); setIsEditing(!isEditing); }}
                                aria-label={isEditing ? 'Cancel lyrics editing' : 'Edit lyrics'} aria-pressed={isEditing}>
                                <IconEdit size={16} /> {isEditing ? 'Cancel editing' : 'Edit lyrics'}
                            </GlassButton>
                        </div>}
                        <div ref={lyricsContainerRef} className="relative flex-1 overflow-y-auto scrollbar-hidden p-4 flex flex-col">
                            {isEditing ? (
                                <>
                                    <GlassTextarea
                                        aria-label="Lyrics text"
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        placeholder="Paste or type lyrics here... (LRC format supported: [mm:ss.xx]text)"
                                        className="flex-1"
                                        style={{ flex: 1, resize: 'none' }}
                                    />
                                    <GlassButton variant="ghost" onClick={saveLyrics} disabled={saving} className="mt-3 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Lyrics'}</GlassButton>
                                </>
                            ) : parsedLyrics && parsedLyrics.lines.length > 0 ? (
                                parsedLyrics.isSynced ? (
                                    <div className="flex flex-col gap-3 py-8">
                                        {parsedLyrics.lines.map((line, idx) => (
                                            <GlassButton variant="ghost" type="button" key={idx} data-line-index={idx} onClick={() => { if (line.time >= 0) onSeek(line.time); }} className={`text-left px-3 py-2 rounded-lg transition-all duration-300 cursor-pointer ${idx === currentLineIndex ? 'text-white text-lg font-semibold bg-white/10 scale-105 shadow-lg' : idx < currentLineIndex ? 'text-white/65 text-sm' : 'text-white/60 text-sm hover:text-white/80 hover:bg-white/5'}`}>{line.text}</GlassButton>
                                        ))}
                                    </div>
                                ) : (
                                    <pre className="text-sm text-white/70 whitespace-pre-wrap font-sans leading-relaxed">{displayLyrics}</pre>
                                )
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center">
                                    <GlassEmptyState
                                        icon={<IconMusicNote size={48} />}
                                        title="No Lyrics"
                                        description="No lyrics available for this song"
                                    />
                                    <div className="flex flex-col gap-2 mt-4">
                                        <GlassButton variant="ghost"
                                            onClick={async () => {
                                                if (!currentSong.title || !currentSong.artist) {
                                                    setToast({ message: 'Song must have title and artist to search for lyrics', type: 'error' });
                                                    return;
                                                }
                                                setFetching(true);
                                                try {
                                                    const lyrics = await invoke<string | null>('fetch_lyrics_online', {
                                                        trackName: currentSong.title,
                                                        artistName: currentSong.artist,
                                                        albumName: currentSong.album || '',
                                                        duration: Math.floor(currentSong.duration_seconds)
                                                    });
                                                    if (lyrics) {
                                                        await invoke('save_song_lyrics', { songPath: currentSong.path, lyrics });
                                                        if (currentPath.current === currentSong.path) setUserLyrics(lyrics);
                                                    } else {
                                                        setToast({ message: 'No lyrics found for this song', type: 'info' });
                                                    }
                                                } catch (e) {
                                                    console.error('Failed to fetch lyrics:', e);
                                                    setToast({ message: 'Could not fetch lyrics. Try again later.', type: 'error' });
                                                }
                                                setFetching(false);
                                            }}
                                            disabled={fetching}
                                            className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {fetching ? (
                                                <div className="flex items-center gap-2">
                                                    <IconSpinner className="animate-spin w-4 h-4 text-neutral-400" />
                                                    <span className="text-neutral-400">Searching...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <IconDownload size={16} />
                                                    Download Lyrics
                                                </>
                                            )}
                                        </GlassButton>
                                        <GlassButton variant="ghost" onClick={() => { setEditText(''); setIsEditing(true); }} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors">Add Manually</GlassButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>}
                </PlayerPanel>}
            </div>

            {/* Footer Info */}
            <div className="relative z-10 px-6 py-2 flex justify-center w-full flex-shrink-0">
                <div className="flex items-center gap-4 text-sm">
                    {currentSong.bitrate && <GlassBadge>{currentSong.bitrate} kbps</GlassBadge>}
                    {currentSong.sample_rate && <GlassBadge>{currentSong.sample_rate} Hz</GlassBadge>}
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] animate-fade-in">
                    <GlassAlert variant={toast.type === 'error' ? 'error' : toast.type === 'success' ? 'success' : 'info'}>
                        {toast.message}
                    </GlassAlert>
                </div>
            )}
        </div>
    );
}
