import { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Song, LoopMode } from '../types';
import { AlbumArt, useSongArt } from './AlbumArt';
import { GlassSlider, GlassButton, GlassHeading, GlassText, GlassTextarea, GlassAlert, GlassEmptyState, GlassBadge } from '@knp-org/liquid-glass-ui';
import { parseLyrics, getCurrentLineIndex } from '../utils/lrcParser';
import { SleepTimerMenu } from './SleepTimerMenu';
import { IconFavorites, IconShuffle, IconSeekBackward, IconPrevTrack, IconPause, IconPlay, IconNextTrack, IconSeekForward, IconLoop, IconVolumeMute, IconVolumeLow, IconVolumeHigh, IconMusicNote, IconX, IconEdit, IconSpinner, IconDownload, IconArrowLeft, IconTimer, IconQueue } from '@knp-org/liquid-glass-ui';

interface PlayerPageProps {
    currentSong: Song;
    currentTime: number;
    isPlaying: boolean;
    isShuffle: boolean;
    onClose: () => void;
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
    sleepTimer,
    onSetSleepTimer,
    onCancelSleepTimer,
    volume,
    onVolumeChange,
}: PlayerPageProps) {
    const artSrc = useSongArt(currentSong);

    const [prevVolume, setPrevVolume] = useState(0.5);

    const handleMuteToggle = () => {
        if (volume > 0) {
            setPrevVolume(volume);
            onVolumeChange(0);
        } else {
            onVolumeChange(prevVolume > 0 ? prevVolume : 0.5);
        }
    };

    // Panel visibility (hidden by default)
    const [showQueue, setShowQueue] = useState(false);
    const [showLyrics, setShowLyrics] = useState(false);
    const [showSleepMenu, setShowSleepMenu] = useState(false);

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
            if (isEditing) { setIsEditing(false); return; }
            if (showSleepMenu) { setShowSleepMenu(false); return; }
            if (showLyrics) { setShowLyrics(false); return; }
            if (showQueue) { setShowQueue(false); return; }
            onClose();
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isEditing, showSleepMenu, showLyrics, showQueue, onClose]);

    useEffect(() => {
        async function loadUserLyrics() {
            try {
                const lyrics = await invoke<string | null>('get_song_lyrics', { songPath: currentSong.path });
                setUserLyrics(lyrics);
            } catch (e) {
                console.error('Failed to load lyrics:', e);
            }
        }
        loadUserLyrics();
        setIsEditing(false);
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
    }, [currentLineIndex, isEditing]);

    async function saveLyrics() {
        setSaving(true);
        try {
            await invoke('save_song_lyrics', { songPath: currentSong.path, lyrics: editText });
            setUserLyrics(editText.trim() || null);
            setIsEditing(false);
        } catch (e) {
            console.error('Failed to save lyrics:', e);
        }
        setSaving(false);
    }

    return (
        <div className="fixed inset-0 z-[2000] bg-neutral-950 flex flex-col animate-fade-in overflow-hidden">
            {/* Background */}
            {artSrc && (
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl scale-110"
                    style={{ backgroundImage: `url(${artSrc})` }}
                ></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90"></div>

            {/* Header */}
            {/* pr keeps the sleep timer clear of the native window controls (3 x 46px) */}
            <div className="relative z-50 flex items-center justify-between p-6 pt-12 pr-[160px]">
                <div data-tauri-drag-region className="absolute inset-0 z-0"></div>
                <GlassButton variant="ghost" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors relative z-10">
                    <IconArrowLeft size={24} />
                </GlassButton>
                <div className="text-sm text-white/50 font-medium relative z-10 pointer-events-none">Now Playing</div>
                <div className="relative z-10">
                    <GlassButton variant="ghost"
                        onClick={() => setShowSleepMenu(!showSleepMenu)}
                        className={`p-2 hover:bg-white/10 rounded-full transition-colors relative ${sleepTimer?.active || showSleepMenu ? 'text-white' : 'text-white/40'}`}
                        title="Sleep Timer"
                    >
                        <IconTimer size={24} />
                        {sleepTimer?.active && (
                            <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div>
                        )}
                    </GlassButton>
                    {showSleepMenu && (
                        <SleepTimerMenu
                            onClose={() => setShowSleepMenu(false)}
                            onSetTimer={onSetSleepTimer}
                            activeTimer={sleepTimer}
                            onCancelTimer={onCancelSleepTimer}
                            currentSongDuration={currentSong.duration_seconds}
                            currentTime={currentTime}
                            className="top-12 right-0"
                        />
                    )}
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex-1 flex relative z-10 overflow-hidden items-center justify-center">
                {/* Queue Side Drawer (Left) */}
                <div className={`absolute left-0 top-0 bottom-0 z-30 w-80 bg-black/40 backdrop-blur-2xl border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${showQueue ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="w-80 h-full flex flex-col">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                            <div>
                                <GlassHeading as="h2" className="text-lg font-semibold text-white">Queue</GlassHeading>
                                <GlassText as="p" className="text-xs text-white/40">{queue.length} songs</GlassText>
                            </div>
                            <GlassButton variant="ghost" onClick={() => setShowQueue(false)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Hide queue">
                                <IconX size={16} />
                            </GlassButton>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-hidden p-2">
                            {queue.map((song, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => onPlayIndex(idx)}
                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all group ${idx === currentIndex ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className="text-xs text-white/30 w-6 text-right font-mono">
                                        {idx === currentIndex && isPlaying ? (
                                            <div className="flex items-center justify-center gap-0.5">
                                                <div className="w-0.5 h-3 bg-white rounded-full animate-soundbar1"></div>
                                                <div className="w-0.5 h-3 bg-white rounded-full animate-soundbar2"></div>
                                            </div>
                                        ) : (idx + 1).toString().padStart(2, '0')}
                                    </div>
                                    <div className="w-10 h-10 rounded overflow-hidden bg-white/5 flex-shrink-0">
                                        <AlbumArt song={song} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm truncate ${idx === currentIndex ? 'text-white font-medium' : 'text-white/70'}`}>{song.title || song.path.split('/').pop()}</div>
                                        <div className="text-xs text-white/40 truncate">{song.artist || 'Unknown Artist'}</div>
                                    </div>
                                    <div className="text-xs text-white/30 font-mono">{Math.floor(song.duration_seconds / 60)}:{String(Math.floor(song.duration_seconds) % 60).padStart(2, '0')}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Player Content (Fixed Center — never shifts when drawers open) */}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl flex flex-col items-center justify-center px-4 sm:px-8 z-10 overflow-y-auto overflow-x-hidden scrollbar-hidden py-4">
                    {/* Album Art Stack Carousel (Prev 3, Active, Next 3) */}
                    <div className="relative w-full flex items-center justify-center mb-4 sm:mb-6 h-52 sm:h-64 md:h-72 lg:h-80 select-none overflow-visible">
                        {/* Previous 3 Songs Stacked (Left) */}
                        {prevSongs.map(({ song, index, offset }) => {
                            const absOffset = Math.abs(offset);
                            const translateX = offset * 42;
                            const scale = 1 - absOffset * 0.12;
                            const blur = absOffset === 3 ? 'blur-md' : absOffset === 2 ? 'blur-sm' : 'blur-[2px]';
                            const opacity = absOffset === 3 ? 'opacity-30' : absOffset === 2 ? 'opacity-50' : 'opacity-75';
                            const zIndex = 10 - absOffset;

                            return (
                                <div
                                    key={`prev-${index}`}
                                    onClick={() => onPlayIndex(index)}
                                    style={{
                                        transform: `translateX(${translateX}%) scale(${scale})`,
                                        zIndex: zIndex,
                                    }}
                                    className={`absolute w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72 lg:w-80 lg:h-80 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-xl cursor-pointer transform-gpu will-change-transform transition-all duration-500 ease-out hover:opacity-100 hover:scale-105 hover:blur-none ${blur} ${opacity}`}
                                    title={`Previous: ${song.title || 'Track'}`}
                                >
                                    <AlbumArt song={song} className="w-full h-full object-cover" />
                                </div>
                            );
                        })}

                        {/* Current Active Song (Center) */}
                        <div className="relative z-20 w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72 lg:w-80 lg:h-80 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/20 flex items-center justify-center bg-black/60 transform-gpu will-change-transform transition-transform duration-500 ease-out hover:scale-105">
                            <AlbumArt song={currentSong} className="w-full h-full" placeholderContent={<div className="text-8xl">💿</div>} useOriginal={true} objectFit="contain" smooth={true} />
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
                                <div
                                    key={`next-${index}`}
                                    onClick={() => onPlayIndex(index)}
                                    style={{
                                        transform: `translateX(${translateX}%) scale(${scale})`,
                                        zIndex: zIndex,
                                    }}
                                    className={`absolute w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72 lg:w-80 lg:h-80 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-xl cursor-pointer transform-gpu will-change-transform transition-all duration-500 ease-out hover:opacity-100 hover:scale-105 hover:blur-none ${blur} ${opacity}`}
                                    title={`Next: ${song.title || 'Track'}`}
                                >
                                    <AlbumArt song={song} className="w-full h-full object-cover" />
                                </div>
                            );
                        })}
                    </div>
                    <div className="text-center mb-4 sm:mb-6 max-w-md w-full px-4">
                        <div className="flex items-center justify-center gap-4 mb-1">
                            <GlassHeading as="h1" className="text-xl sm:text-2xl md:text-3xl font-bold text-white truncate max-w-[80%]">{currentSong.title || "Unknown Title"}</GlassHeading>
                            <GlassButton variant="ghost"
                                onClick={onToggleFavorite}
                                className={`p-2 transition-colors ${isFavorite ? 'text-red-500' : 'text-white/20 hover:text-white'}`}
                                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                            >
                                <IconFavorites size={24} fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isFavorite ? "0" : "2"} />
                            </GlassButton>
                        </div>
                        <GlassText as="p" className="text-base sm:text-lg text-white/60 truncate">{currentSong.artist || "Unknown Artist"}</GlassText>
                        <GlassText as="p" className="text-xs sm:text-sm text-white/40 truncate mt-1">{currentSong.album || "Unknown Album"}</GlassText>
                    </div>
                    <div className="w-full max-w-md mb-6">
                        <div className="px-2">
                            <GlassSlider
                                min={0}
                                max={currentSong.duration_seconds || 100}
                                value={currentTime}
                                shimmer={true}
                                onChange={(e) => onSeek(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-white/40 font-mono">
                            <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime) % 60).padStart(2, '0')}</span>
                            <span>{Math.floor(currentSong.duration_seconds / 60)}:{String(Math.floor(currentSong.duration_seconds) % 60).padStart(2, '0')}</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center w-full mt-2 mb-4">
                        {/* Left Controls */}
                        <div className="flex-1 flex justify-end pr-4 md:pr-8">
                            <GlassButton
                                variant="ghost"
                                onClick={onToggleShuffle}
                                className={`!p-3 !rounded-full transition-all ${isShuffle ? '!text-white !bg-white/15 shadow-md' : '!text-white/30 opacity-50 hover:opacity-80'}`}
                                title={isShuffle ? "Shuffle On" : "Shuffle Off"}
                            >
                                <IconShuffle variant={isShuffle ? 'on' : 'off'} size={24} />
                            </GlassButton>
                        </div>

                        {/* Center Controls */}
                        <div className="flex items-center gap-4 md:gap-8">
                            <div className="flex items-center gap-2 md:gap-4">
                                <GlassButton variant="ghost" onClick={onSeekBackward} className="p-2 text-white/40 hover:text-white transition-colors" title="Seek Backward 10s">
                                    <IconSeekBackward size={24} />
                                </GlassButton>
                                <GlassButton variant="ghost" onClick={onPrevTrack} className="p-3 text-white/60 hover:text-white transition-colors">
                                    <IconPrevTrack size={32} />
                                </GlassButton>
                            </div>

                            <GlassButton 
                                variant="primary" 
                                shape="circle" 
                                onClick={onTogglePlay} 
                                className="!w-16 !h-16 md:!w-20 md:!h-20 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/20 flex-shrink-0"
                            >
                                {isPlaying ? <IconPause size={32} /> : <IconPlay size={32} />}
                            </GlassButton>

                            <div className="flex items-center gap-2 md:gap-4">
                                <GlassButton variant="ghost" onClick={onNextTrack} className="p-3 text-white/60 hover:text-white transition-colors">
                                    <IconNextTrack size={32} />
                                </GlassButton>
                                <GlassButton variant="ghost" onClick={onSeekForward} className="p-2 text-white/40 hover:text-white transition-colors" title="Seek Forward 10s">
                                    <IconSeekForward size={24} />
                                </GlassButton>
                            </div>
                        </div>

                        {/* Right Controls */}
                        <div className="flex-1 flex justify-start items-center gap-2 md:gap-4 pl-4 md:pl-8">
                            <GlassButton
                                variant="ghost"
                                onClick={onToggleLoop}
                                className={`!p-3 !rounded-full transition-all relative ${loopMode !== 'off' ? '!text-white !bg-white/15 shadow-md' : '!text-white/30 opacity-50 hover:opacity-80'}`}
                                title={loopMode === 'off' ? "Repeat Off" : loopMode === 'all' ? "Repeat All" : "Repeat Current Track"}
                            >
                                <IconLoop variant={loopMode} size={24} />
                            </GlassButton>
                            
                            <div className="hidden sm:flex items-center gap-2 group/volume" onWheel={(e) => {
                                const delta = e.deltaY > 0 ? -0.05 : 0.05;
                                onVolumeChange(Math.min(Math.max(volume + delta, 0), 1));
                            }}>
                                <GlassButton variant="ghost" onClick={handleMuteToggle} className="text-white/40 hover:text-white transition-colors">
                                    {volume === 0 ? (
                                        <IconVolumeMute size={20} />
                                    ) : volume < 0.5 ? (
                                        <IconVolumeLow size={20} />
                                    ) : (
                                        <IconVolumeHigh size={20} />
                                    )}
                                </GlassButton>
                                <div className="w-16 md:w-24 px-1">
                                    <GlassSlider
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={volume}
                                        onChange={(e) => onVolumeChange(Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel Toggle Buttons */}
                    <div className="flex items-center gap-3 mt-6">
                        <GlassButton variant="ghost"
                            onClick={() => setShowQueue(!showQueue)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${showQueue ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}`}
                            title="Toggle queue"
                        >
                            <IconQueue size={16} />
                            <span className="text-xs font-medium">Queue</span>
                        </GlassButton>
                        <GlassButton variant="ghost"
                            onClick={() => setShowLyrics(!showLyrics)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${showLyrics ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}`}
                            title="Toggle lyrics"
                        >
                            <IconMusicNote size={16} />
                            <span className="text-xs font-medium">Lyrics</span>
                        </GlassButton>
                    </div>
                </div>

                {/* Lyrics Side Drawer (Right) */}
                <div className={`absolute right-0 top-0 bottom-0 z-30 w-80 bg-black/40 backdrop-blur-2xl border-l border-white/10 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${showLyrics ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="w-80 h-full flex flex-col">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                            <GlassHeading as="h2" className="text-lg font-semibold text-white flex items-center gap-2">
                                <IconMusicNote size={18} className="text-white/60" />
                                Lyrics
                            </GlassHeading>
                            <div className="flex items-center gap-1">
                                {!currentSong.lyrics && (
                                    <GlassButton variant="ghost" onClick={() => { setEditText(userLyrics || ''); setIsEditing(!isEditing); }} className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`} title={isEditing ? "Stop editing" : "Edit lyrics"}>
                                        <IconEdit size={16} />
                                    </GlassButton>
                                )}
                                <GlassButton variant="ghost" onClick={() => { setIsEditing(false); setShowLyrics(false); }} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Close lyrics">
                                    <IconX size={16} />
                                </GlassButton>
                            </div>
                        </div>
                        <div ref={lyricsContainerRef} className="relative flex-1 overflow-y-auto scrollbar-hidden p-4 flex flex-col">
                            {isEditing ? (
                                <>
                                    <GlassTextarea
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
                                            <div key={idx} data-line-index={idx} onClick={() => { if (line.time >= 0) onSeek(line.time); }} className={`px-3 py-2 rounded-lg transition-all duration-300 cursor-pointer ${idx === currentLineIndex ? 'text-white text-lg font-semibold bg-white/10 scale-105 shadow-lg' : idx < currentLineIndex ? 'text-white/40 text-sm' : 'text-white/60 text-sm hover:text-white/80 hover:bg-white/5'}`}>{line.text}</div>
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
                                                        setUserLyrics(lyrics);
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
                    </div>
                </div>
            </div>

            {/* Footer Info */}
            <div className="relative z-10 p-6 flex justify-center w-full">
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
