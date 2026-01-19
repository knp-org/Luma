import { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Song, LoopMode } from '../types';
import { AlbumArt, useSongArt } from './AlbumArt';
import { parseLyrics, getCurrentLineIndex } from '../utils/lrcParser';
import { SleepTimerMenu } from './SleepTimerMenu';

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
}: PlayerPageProps) {
    const artSrc = useSongArt(currentSong);

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

    useEffect(() => {
        if (currentLineIndex < 0 || !lyricsContainerRef.current || isEditing) return;
        const container = lyricsContainerRef.current;
        const activeElement = container.querySelector(`[data-line-index="${currentLineIndex}"]`);
        if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        <div className="fixed inset-0 z-[200] bg-neutral-950 flex flex-col animate-fade-in overflow-hidden">
            {/* Background */}
            {artSrc && (
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl scale-110"
                    style={{ backgroundImage: `url(${artSrc})` }}
                ></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90"></div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-6">
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </svg>
                </button>
                <div className="text-sm text-white/50 font-medium">Now Playing</div>
                <div className="relative">
                    <button
                        onClick={() => setShowSleepMenu(!showSleepMenu)}
                        className={`p-2 hover:bg-white/10 rounded-full transition-colors relative ${sleepTimer?.active || showSleepMenu ? 'text-white' : 'text-white/40'}`}
                        title="Sleep Timer"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                        {sleepTimer?.active && (
                            <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div>
                        )}
                    </button>
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
            <div className="flex-1 flex relative z-10 overflow-hidden">
                {/* Queue Toggle / Panel */}
                {showQueue && (
                    <div className="w-80 border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-sm">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Queue</h2>
                                <p className="text-xs text-white/40">{queue.length} songs</p>
                            </div>
                            <button onClick={() => setShowQueue(false)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Hide queue">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
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
                )}

                {/* Player Content */}
                <div className="flex-1 flex flex-col items-center justify-center px-8 relative">
                    <div className="w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 mb-8 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 flex items-center justify-center bg-black/40">
                        <AlbumArt song={currentSong} className="w-full h-full" placeholderContent={<div className="text-8xl">💿</div>} useOriginal={true} objectFit="contain" />
                    </div>
                    <div className="text-center mb-8 max-w-md w-full px-4">
                        <div className="flex items-center justify-center gap-4 mb-2">
                            <h1 className="text-2xl md:text-3xl font-bold text-white truncate max-w-[80%]">{currentSong.title || "Unknown Title"}</h1>
                            <button
                                onClick={onToggleFavorite}
                                className={`p-2 transition-colors ${isFavorite ? 'text-red-500' : 'text-white/20 hover:text-white'}`}
                                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isFavorite ? "0" : "2"}>
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-lg text-white/60 truncate">{currentSong.artist || "Unknown Artist"}</p>
                        <p className="text-sm text-white/40 truncate mt-1">{currentSong.album || "Unknown Album"}</p>
                    </div>
                    <div className="w-full max-w-md mb-6">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer relative group" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - rect.left) / rect.width) * currentSong.duration_seconds); }}>
                            <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${(currentTime / currentSong.duration_seconds) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-white/40 font-mono">
                            <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime) % 60).padStart(2, '0')}</span>
                            <span>{Math.floor(currentSong.duration_seconds / 60)}:{String(Math.floor(currentSong.duration_seconds) % 60).padStart(2, '0')}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <button onClick={onToggleShuffle} className={`p-3 transition-colors ${isShuffle ? 'text-white' : 'text-white/40 hover:text-white'}`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" /></svg>
                        </button>

                        <div className="flex items-center gap-4">
                            <button onClick={onSeekBackward} className="p-2 text-white/40 hover:text-white transition-colors" title="Seek Backward 10s">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
                                </svg>
                            </button>
                            <button onClick={onPrevTrack} className="p-3 text-white/60 hover:text-white transition-colors">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" /></svg>
                            </button>
                        </div>

                        <button onClick={onTogglePlay} className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/20">
                            {isPlaying ? <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg> : <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z" /></svg>}
                        </button>

                        <div className="flex items-center gap-4">
                            <button onClick={onNextTrack} className="p-3 text-white/60 hover:text-white transition-colors">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                            </button>
                            <button onClick={onSeekForward} className="p-2 text-white/40 hover:text-white transition-colors" title="Seek Forward 10s">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                                </svg>
                            </button>
                        </div>

                        <button onClick={onToggleLoop} className={`p-3 transition-colors relative ${loopMode !== 'off' ? 'text-white' : 'text-white/40 hover:text-white'}`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
                            {loopMode === 'one' && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold bg-black/50 rounded-full w-4 h-4 flex items-center justify-center border border-white/20">1</span>}
                        </button>
                    </div>

                    {/* Panel Toggle Buttons */}
                    <div className="flex items-center gap-3 mt-6">
                        <button
                            onClick={() => setShowQueue(!showQueue)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${showQueue ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}`}
                            title="Toggle queue"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                            </svg>
                            <span className="text-xs font-medium">Queue</span>
                        </button>
                        <button
                            onClick={() => setShowLyrics(!showLyrics)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${showLyrics ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}`}
                            title="Toggle lyrics"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                            <span className="text-xs font-medium">Lyrics</span>
                        </button>
                    </div>
                </div>

                {/* Lyrics Toggle / Panel */}
                {showLyrics && (
                    <div className="w-80 border-l border-white/10 flex flex-col bg-black/20 backdrop-blur-sm">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/60"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                                Lyrics
                            </h2>
                            <div className="flex items-center gap-1">
                                {!currentSong.lyrics && (
                                    <button onClick={() => { setEditText(userLyrics || ''); setIsEditing(!isEditing); }} className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`} title={isEditing ? "Cancel" : "Edit lyrics"}>
                                        {isEditing ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>}
                                    </button>
                                )}
                                <button onClick={() => setShowLyrics(false)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Hide lyrics">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto scrollbar-hidden p-4 flex flex-col">
                            {isEditing ? (
                                <>
                                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} placeholder="Paste or type lyrics here... (LRC format supported: [mm:ss.xx]text)" className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:ring-1 focus:ring-white/30 font-sans leading-relaxed" />
                                    <button onClick={saveLyrics} disabled={saving} className="mt-3 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Lyrics'}</button>
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
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-white/20 mb-4"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                                    <p className="text-white/40 text-sm mb-4">No lyrics available</p>
                                    <div className="flex flex-col gap-2">
                                        <button
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
                                                    <svg className="animate-spin w-4 h-4 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span className="text-neutral-400">Searching...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
                                                    Download Lyrics
                                                </>
                                            )}
                                        </button>
                                        <button onClick={() => { setEditText(''); setIsEditing(true); }} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors">Add Manually</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="relative z-10 p-6 flex justify-center">
                <div className="flex items-center gap-4 text-sm text-white/30">
                    {currentSong.bitrate && <span>{currentSong.bitrate} kbps</span>}
                    {currentSong.sample_rate && <span>{currentSong.sample_rate} Hz</span>}
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] animate-fade-in">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg backdrop-blur-md text-xs font-medium ${toast.type === 'error'
                        ? 'bg-red-500/90 text-white'
                        : toast.type === 'success'
                            ? 'bg-green-500/90 text-white'
                            : 'bg-neutral-800/90 text-white/90'
                        }`}>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
