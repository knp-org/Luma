import { useState, useEffect, useRef, memo } from 'react';
import { Song, Playlist } from '../types';
import { AlbumArt } from './AlbumArt';

interface LibraryProps {
    songs: Song[];
    loading: boolean;
    currentSong: Song | null;
    isPlaying: boolean;
    playlists: Playlist[];
    menuOpenFor: string | null;
    onPlaySong: (song: Song) => void;
    onMenuToggle: (path: string | null) => void;
    onAddToPlaylist: (playlistName: string, songPath: string, keepOpen?: boolean) => void;
    onShowSongInfo: (song: Song) => void;
    onGoToSettings: () => void;
}

export function Library({
    songs,
    loading,
    currentSong,
    isPlaying,
    playlists,
    menuOpenFor,
    onPlaySong,
    onMenuToggle,
    onAddToPlaylist,
    onShowSongInfo,
    onGoToSettings,
}: LibraryProps) {
    const [visibleCount, setVisibleCount] = useState(50);
    const [searchQuery, setSearchQuery] = useState('');
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Reset visible count when songs change (e.g. after a fresh sync)
    useEffect(() => {
        setVisibleCount(50);
    }, [songs.length]);

    useEffect(() => {
        if (!loadMoreRef.current) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && visibleCount < songs.length) {
                setVisibleCount(prev => prev + 50);
            }
        }, { threshold: 0.1 });

        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [visibleCount, songs.length]);

    return (
        <>
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">Your Library</h1>
                        <p className="text-white/30 text-sm mt-1 font-light">{songs.length} songs</p>
                    </div>
                    <div className="relative flex-1 max-w-md">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search songs, artists, albums..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/20 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                    </div>
                ) : songs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-white/40 gap-4">
                        <p className="font-light">No songs in your library</p>
                        <button
                            onClick={onGoToSettings}
                            className="px-4 py-2 bg-white text-black hover:bg-neutral-200 rounded-lg text-sm transition-colors font-medium"
                        >
                            Go to settings to sync
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-1 pb-32">
                        {songs
                            .filter(song => {
                                if (!searchQuery.trim()) return true;
                                const query = searchQuery.toLowerCase();
                                return (
                                    (song.title?.toLowerCase().includes(query)) ||
                                    (song.artist?.toLowerCase().includes(query)) ||
                                    (song.album?.toLowerCase().includes(query)) ||
                                    (song.path.toLowerCase().includes(query))
                                );
                            })
                            .slice(0, visibleCount)
                            .map((song, idx) => (
                                <SongRow
                                    key={idx}
                                    song={song}
                                    isCurrent={currentSong?.path === song.path}
                                    isPlaying={isPlaying}
                                    menuOpen={menuOpenFor === song.path}
                                    playlists={playlists}
                                    onPlay={() => onPlaySong(song)}
                                    onMenuToggle={() => onMenuToggle(menuOpenFor === song.path ? null : song.path)}
                                    onAddToPlaylist={(playlistName, keepOpen) => onAddToPlaylist(playlistName, song.path, keepOpen)}
                                    onShowInfo={() => onShowSongInfo(song)}
                                />
                            ))}
                        {visibleCount < songs.length && (
                            <div ref={loadMoreRef} className="h-20 flex items-center justify-center text-white/20 text-xs font-mono uppercase tracking-widest animate-pulse">
                                Loading more tracks...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

interface SongRowProps {
    song: Song;
    isCurrent: boolean;
    isPlaying: boolean;
    menuOpen: boolean;
    playlists: Playlist[];
    onPlay: () => void;
    onMenuToggle: () => void;
    onAddToPlaylist: (playlistName: string, keepOpen?: boolean) => void;
    onShowInfo: () => void;
}

const SongRow = memo(({
    song,
    isCurrent,
    isPlaying,
    menuOpen,
    playlists,
    onPlay,
    onMenuToggle,
    onAddToPlaylist,
    onShowInfo,
}: SongRowProps) => {
    const [showSubmenu, setShowSubmenu] = useState(false);

    useEffect(() => {
        if (!menuOpen) setShowSubmenu(false);
    }, [menuOpen]);

    return (
        <div
            onClick={onPlay}
            className={`group flex items-center p-2 rounded-lg transition-all cursor-pointer border border-transparent relative
        ${isCurrent
                    ? "bg-white/10 border-white/10 shadow-lg backdrop-blur-sm"
                    : "hover:bg-white/5 hover:border-white/5"
                } ${menuOpen ? "z-40" : "z-0"}`}
        >
            {/* Album Art / Play Icon */}
            <div className="relative w-12 h-12 rounded-lg overflow-hidden mr-4 flex-shrink-0">
                <AlbumArt song={song} className="w-full h-full" />

                {/* Play overlay on hover (only when not current) */}
                {!isCurrent && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M8 5v14l11-7L8 5z" />
                        </svg>
                    </div>
                )}

                {/* Playing animation for current song */}
                {isCurrent && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-0.5">
                        {isPlaying ? (
                            // Animated sound bars
                            <>
                                <div className="w-1 bg-white rounded-full animate-soundbar1" style={{ height: '60%' }}></div>
                                <div className="w-1 bg-white rounded-full animate-soundbar2" style={{ height: '80%' }}></div>
                                <div className="w-1 bg-white rounded-full animate-soundbar3" style={{ height: '50%' }}></div>
                                <div className="w-1 bg-white rounded-full animate-soundbar4" style={{ height: '70%' }}></div>
                            </>
                        ) : (
                            // Paused icon
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <h4 className={`font-medium truncate text-sm ${isCurrent ? "text-white" : "text-white/80"}`}>
                    {song.title || song.path.split('/').pop()}
                </h4>
                <p className="text-xs text-white/40 truncate group-hover:text-white/60 transition-colors">
                    {song.artist || "Unknown Artist"} • {song.album || "Unknown Album"}
                </p>
            </div>
            <div className="text-xs font-mono text-white/20 pl-4 group-hover:text-white/50 w-12 text-right">
                {Math.floor(song.duration_seconds / 60)}:{String(Math.floor(song.duration_seconds) % 60).padStart(2, '0')}
            </div>

            {/* Actions Menu */}
            <div className="relative ml-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onMenuToggle();
                    }}
                    className={`p-2 rounded-md transition-all ${menuOpen
                        ? 'text-white bg-white/10 opacity-100'
                        : 'text-white/30 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100'}`}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                </button>

                {menuOpen && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-56 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-[100] overflow-visible animate-fade-in ring-1 ring-white/10"
                    >
                        {/* Song Info Option */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowInfo();
                                onMenuToggle();
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-3 border-b border-white/5 relative z-10"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/50">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                            </svg>
                            Song Info
                        </button>

                        {/* Add to Playlist Trigger - with + icon */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSubmenu(!showSubmenu);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${showSubmenu ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                                        <path d="M12 5v14M5 12h14" />
                                    </svg>
                                    Add to Playlist
                                </div>
                            </button>

                            {/* Side Submenu - Absolute Left */}
                            {showSubmenu && (
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-full top-0 mr-2 w-48 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-[101] overflow-hidden ring-1 ring-white/10 animate-fade-in"
                                >
                                    <div className="px-4 py-2 text-[10px] text-white/40 font-mono uppercase tracking-wider bg-white/5 border-b border-white/5">
                                        Select Playlists
                                    </div>
                                    <div className="max-h-48 overflow-y-auto scrollbar-hidden">
                                        {playlists.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-white/30 italic text-center">No playlists created</div>
                                        ) : (
                                            playlists.map((pl, i) => {
                                                const isAdded = pl.tracks.includes(song.path);
                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onAddToPlaylist(pl.name, true);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-3 group/item"
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAdded ? 'bg-white border-white' : 'border-white/30 group-hover/item:border-white/60'}`}>
                                                            {isAdded && (
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4">
                                                                    <path d="M20 6L9 17l-5-5" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <span className="truncate">{pl.name}</span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
