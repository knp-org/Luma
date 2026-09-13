import { useState, useEffect, useRef, useMemo, memo } from 'react';
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
    onPlaySong: (song: Song, context?: Song[]) => void;
    onQueue: (song: Song, next?: boolean) => void;
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
    onQueue,
    onMenuToggle,
    onAddToPlaylist,
    onShowSongInfo,
    onGoToSettings,
    title = "Your Library",
    emptyMessage = "No songs in your library",
    showSyncButton = true,
}: LibraryProps) {
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(640);
    const [focusedPath, setFocusedPath] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    const filteredSongs = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return songs.filter(song => !query || [song.title, song.artist, song.album, song.path].some(value => value?.toLowerCase().includes(query)));
    }, [songs, searchQuery]);

    const latest = useRef({ onPlaySong, onQueue, onMenuToggle, onAddToPlaylist, onShowSongInfo, filteredSongs, menuOpenFor });
    latest.current = { onPlaySong, onQueue, onMenuToggle, onAddToPlaylist, onShowSongInfo, filteredSongs, menuOpenFor };
    // Stable handlers let memoized rows skip unrelated playback-clock updates.
    const actions = useMemo(() => ({
        onPlay: (song: Song) => latest.current.onPlaySong(song, latest.current.filteredSongs),
        onQueue: (song: Song, next: boolean) => { latest.current.onQueue(song, next); latest.current.onMenuToggle(null); },
        onMenuToggle: (song: Song) => latest.current.onMenuToggle(latest.current.menuOpenFor === song.path ? null : song.path),
        onAddToPlaylist: (song: Song, name: string, keepOpen?: boolean) => latest.current.onAddToPlaylist(name, song.path, keepOpen),
        onShowInfo: (song: Song) => latest.current.onShowSongInfo(song),
    }), []);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        setScrollTop(0);
    }, [songs.length, searchQuery, title]);
    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;
        const observer = new ResizeObserver(() => setViewportHeight(node.clientHeight));
        observer.observe(node);
        setViewportHeight(node.clientHeight || 640);
        return () => observer.disconnect();
    }, []);
    const rowHeight = 70;
    const first = Math.max(0, Math.min(filteredSongs.length - 1, Math.floor(scrollTop / rowHeight) - 6));
    const last = Math.min(filteredSongs.length, first + Math.ceil(viewportHeight / rowHeight) + 12);
    const visibleIndices = Array.from({ length: Math.max(0, last - first) }, (_, i) => first + i);
    // Keep an open menu or keyboard focus mounted while its row scrolls away.
    for (const path of [menuOpenFor, focusedPath]) {
        const index = path ? filteredSongs.findIndex(song => song.path === path) : -1;
        if (index >= 0 && !visibleIndices.includes(index)) visibleIndices.push(index);
    }
    visibleIndices.sort((a, b) => a - b);

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

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 scrollbar-hidden"
                onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
                onFocusCapture={event => setFocusedPath((event.target as HTMLElement).closest<HTMLElement>('[data-song-path]')?.dataset.songPath ?? null)}
                onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedPath(null); }}>
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
                    <div role="list" aria-label={title} style={{ position: 'relative', height: filteredSongs.length * rowHeight + 128 }}>
                        {visibleIndices.map(index => {
                            const song = filteredSongs[index];
                            return (
                                <div key={song.path} role="listitem" aria-setsize={filteredSongs.length} aria-posinset={index + 1}
                                    data-song-path={song.path}
                                    style={{ position: 'absolute', top: index * rowHeight, left: 0, right: 0, height: 66, zIndex: menuOpenFor === song.path ? 40 : undefined }}>
                                    <SongRow song={song} isCurrent={currentSong?.path === song.path}
                                        isPlaying={currentSong?.path === song.path && isPlaying}
                                        menuOpen={menuOpenFor === song.path} playlists={playlists} {...actions} />
                                </div>
                            );
                        })}
                        {filteredSongs.length === 0 && <p className="p-6 text-white/50">No matching songs</p>}
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
    onPlay: (song: Song) => void;
    onQueue: (song: Song, next: boolean) => void;
    onMenuToggle: (song: Song) => void;
    onAddToPlaylist: (song: Song, playlistName: string, keepOpen?: boolean) => void;
    onShowInfo: (song: Song) => void;
}

const SongRow = memo(({
    song,
    isCurrent,
    isPlaying,
    menuOpen,
    playlists,
    onPlay,
    onQueue,
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
            onClick={() => onPlay(song)}
            style={{ height: 66, boxSizing: 'border-box' }}
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
                        onMenuToggle(song);
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
                        <GlassButton variant="ghost" className="w-full text-left p-3" disabled={song.missing} onClick={() => onQueue(song, true)}>Play next</GlassButton>
                        <GlassButton variant="ghost" className="w-full text-left p-3" disabled={song.missing} onClick={() => onQueue(song, false)}>Add to queue</GlassButton>
                        {/* Song Info Option */}
                        <GlassButton variant="ghost"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowInfo(song);
                                onMenuToggle(song);
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
                                                            onAddToPlaylist(song, pl.name, true);
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
