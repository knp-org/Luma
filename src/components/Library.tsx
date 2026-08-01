import { useState, useEffect, useRef, memo } from 'react';
import { Song, Playlist } from '../types';
import { AlbumArt } from './AlbumArt';
import { GlassButton, GlassHeading, GlassText, GlassSearch, GlassEmptyState, GlassBadge, GlassSkeleton } from '@knp-org/liquid-glass-ui';
import { IconPlaySolid, IconMoreVertical, IconCheck, IconPause, IconInfo, IconPlus, IconMusicNote } from '@knp-org/liquid-glass-ui';

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
    title?: string;
    emptyMessage?: string;
    showSyncButton?: boolean;
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
    title = "Your Library",
    emptyMessage = "No songs in your library",
    showSyncButton = true,
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
                        <GlassHeading as="h1" className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">{title}</GlassHeading>
                        <div className="mt-2">
                            <GlassBadge>{songs.length} songs</GlassBadge>
                        </div>
                    </div>
                    <div className="flex-1 max-w-md">
                        <GlassSearch
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search songs, artists, albums..."
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-hidden">
                {loading ? (
                    <div className="flex flex-col gap-3 p-4">
                        <GlassSkeleton height="48px" />
                        <GlassSkeleton height="48px" />
                        <GlassSkeleton height="48px" />
                    </div>
                ) : songs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-white/40 gap-4">
                        <GlassEmptyState
                            icon={<IconMusicNote size={48} />}
                            title="No Songs"
                            description={emptyMessage}
                            action={showSyncButton ? (
                                <GlassButton onClick={onGoToSettings} variant="primary">
                                    Go to settings to sync
                                </GlassButton>
                            ) : undefined}
                        />
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
                            <IconPlaySolid size={20} fill="white" />
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
                            <IconPause size={20} fill="white" />
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <GlassHeading as="h4" className={`font-medium truncate text-sm ${isCurrent ? "text-white" : "text-white/80"}`}>
                    {song.title || song.path.split('/').pop()}
                </GlassHeading>
                <GlassText as="p" className="text-xs text-white/40 truncate group-hover:text-white/60 transition-colors">
                    {song.artist || "Unknown Artist"} • {song.album || "Unknown Album"}
                </GlassText>
            </div>
            <div className="text-xs font-mono text-white/20 pl-4 group-hover:text-white/50 w-12 text-right">
                {Math.floor(song.duration_seconds / 60)}:{String(Math.floor(song.duration_seconds) % 60).padStart(2, '0')}
            </div>

            {/* Actions Menu */}
            <div className="relative ml-2">
                <GlassButton
                    variant="ghost"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMenuToggle();
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${menuOpen ? 'bg-white/10 text-white opacity-100' : 'text-white/30 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100'}`}
                >
                    <IconMoreVertical size={20} />
                </GlassButton>

                {menuOpen && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-56 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-[100] overflow-visible animate-fade-in ring-1 ring-white/10"
                    >
                        {/* Song Info Option */}
                        <GlassButton variant="ghost"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowInfo();
                                onMenuToggle();
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-3 border-b border-white/5 relative z-10"
                        >
                            <IconInfo size={18} className="text-white/50" />
                            Song Info
                        </GlassButton>

                        {/* Add to Playlist Trigger - with + icon */}
                        <div className="relative">
                            <GlassButton variant="ghost"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSubmenu(!showSubmenu);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${showSubmenu ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <IconPlus size={18} className="text-white/50" />
                                    Add to Playlist
                                </div>
                            </GlassButton>

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
                                                    <GlassButton variant="ghost"
                                                        key={i}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onAddToPlaylist(pl.name, true);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-3 group/item"
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAdded ? 'bg-white border-white' : 'border-white/30 group-hover/item:border-white/60'}`}>
                                                            {isAdded && (
                                                                <IconCheck size={10} stroke="black" />
                                                            )}
                                                        </div>
                                                        <span className="truncate">{pl.name}</span>
                                                    </GlassButton>
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
