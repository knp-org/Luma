import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Playlist, Song } from '../types';
import { AlbumArt } from './AlbumArt';
import { useModal } from '../hooks/useModal';
import { GlassButton, GlassInput, GlassCard, GlassHeading, GlassText, GlassBadge, GlassEmptyState } from '@knp-org/liquid-glass-ui';
import { IconMusicNote, IconPlaySolid, IconShuffle, IconTrash } from '@knp-org/liquid-glass-ui';

interface PlaylistsProps {
    songs: Song[];
    onPlayPlaylist: (playlistSongs: Song[], startIndex?: number, shuffle?: boolean) => void;
}

export function Playlists({ songs, onPlayPlaylist }: PlaylistsProps) {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [creating, setCreating] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
    const { showAlert } = useModal();


    useEffect(() => {
        loadPlaylists();

        const handleDelete = async (e: any) => {
            const playlistName = e.detail;
            try {
                await invoke("delete_playlist", { playlistName });
                loadPlaylists();
            } catch (err) {
                showAlert("Failed to delete: " + err, "Error");
            }
        };

        window.addEventListener('delete-playlist', handleDelete);
        return () => window.removeEventListener('delete-playlist', handleDelete);
    }, []);

    async function loadPlaylists() {
        try {
            const result = await invoke<Playlist[]>("get_playlists");
            setPlaylists(result);
        } catch (e) {
            console.error(e);
        }
    }

    async function createPlaylist(e: React.FormEvent) {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;

        setCreating(true);
        try {
            await invoke("create_playlist", { name: newPlaylistName });
            setNewPlaylistName("");
            loadPlaylists();
        } catch (e) {
            showAlert("Failed to create: " + e, "Error");
        }
        setCreating(false);
    }

    const getPlaylistSongs = (playlist: Playlist): Song[] => {
        return playlist.tracks.map(path => {
            const realSong = songs.find(s => s.path === path);
            if (realSong) return realSong;
            const fallback: Song = {
                path,
                title: path.split('/').pop() || 'Unknown',
                artist: "Unknown Artist",
                album: "Unknown Album",
                duration_seconds: 0,
                file_size_bytes: 0,
                has_album_art: false
            };
            return fallback;
        });
    };

    const handlePlayContext = (playlist: Playlist, startIndex: number = 0, shuffle: boolean = false) => {
        const plSongs = getPlaylistSongs(playlist);
        onPlayPlaylist(plSongs, startIndex, shuffle);
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="mb-8">
                <GlassHeading as="h1" className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">Your Playlists</GlassHeading>
                <div className="mt-2">
                    <GlassBadge>{playlists.length} playlists</GlassBadge>
                </div>
            </div>

            {selectedPlaylist ? (
                <div className="flex-1 flex flex-col animate-fade-in pb-20">
                    <GlassButton variant="ghost"
                        onClick={() => setSelectedPlaylist(null)}
                        className="self-start text-sm text-white/50 hover:text-white mb-4 flex items-center gap-2 group transition-all"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Playlists
                    </GlassButton>

                    <div className="flex items-end gap-6 mb-8">
                        <div className="w-48 h-48 bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-white/10 relative group">
                            {/* Collage logic for detailed view */}
                            {(() => {
                                const plSongs = selectedPlaylist.tracks
                                    .map(t => songs.find(s => s.path === t))
                                    .filter(s => s && s.has_album_art) as Song[];

                                // Get unique albums to avoid same art repeated if possible
                                const uniqueAlbumSongs = plSongs.reduce((acc, current) => {
                                    const x = acc.find(item => item.album === current.album);
                                    if (!x) {
                                        return acc.concat([current]);
                                    } else {
                                        return acc;
                                    }
                                }, [] as Song[]);

                                const displaySongs = uniqueAlbumSongs.length >= 4 ? uniqueAlbumSongs.slice(0, 4) : plSongs.slice(0, 4);

                                if (displaySongs.length >= 4) {
                                    return (
                                        <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                                            {displaySongs.map((s, i) => (
                                                <div key={i} className="overflow-hidden">
                                                    <AlbumArt song={s} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    );
                                } else if (displaySongs.length > 0) {
                                    return (
                                        <AlbumArt song={displaySongs[0]} className="w-full h-full object-cover" />
                                    );
                                } else {
                                    return (
                                        <div className="w-full h-full flex items-center justify-center text-6xl bg-white/5">🎵</div>
                                    );
                                }
                            })()}
                        </div>
                        <div className="flex flex-col gap-4">
                            <div>
                                <GlassHeading as="h1" className="text-4xl font-bold text-white mb-2 tracking-tight">{selectedPlaylist.name}</GlassHeading>
                                <div className="mt-1">
                                    <GlassBadge>{selectedPlaylist.tracks.length} Songs</GlassBadge>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <GlassButton
                                    onClick={() => handlePlayContext(selectedPlaylist, 0, false)}
                                    shape="pill"
                                    variant="primary"
                                    className="font-bold flex items-center gap-2"
                                >
                                    <IconPlaySolid size={20} />
                                    Play
                                </GlassButton>
                                <GlassButton
                                    onClick={() => handlePlayContext(selectedPlaylist, 0, true)}
                                    shape="pill"
                                    className="font-bold flex items-center gap-2"
                                >
                                    <IconShuffle size={20} />
                                    Shuffle
                                </GlassButton>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-hidden">
                        {selectedPlaylist.tracks.length === 0 ? (
                            <GlassEmptyState
                                icon={<IconMusicNote size={48} />}
                                title="Empty Playlist"
                                description="No songs in this playlist yet. Add them from your Library."
                            />
                        ) : (
                            selectedPlaylist.tracks.map((trackPath, idx) => {
                                const song = songs.find(s => s.path === trackPath);
                                // Construct complete fallback if song not found, for display
                                const displaySong: Song = song || {
                                    path: trackPath,
                                    title: trackPath.split('/').pop() || 'Unknown',
                                    artist: "Unknown Artist",
                                    duration_seconds: 0,
                                    file_size_bytes: 0,
                                    has_album_art: false
                                };

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handlePlayContext(selectedPlaylist, idx, false)}
                                        className="flex items-center gap-4 p-3 text-white/80 hover:bg-white/5 rounded-lg cursor-pointer transition-colors border-b border-white/5 last:border-0 hover:border-transparent group"
                                    >
                                        <div className="text-white/30 w-6 text-right font-mono text-xs">{idx + 1}</div>
                                        <div className="w-10 h-10 rounded overflow-hidden bg-white/5 flex-shrink-0">
                                            <AlbumArt song={displaySong} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white group-hover:text-white transition-colors truncate">{displaySong.title}</div>
                                            <div className="text-xs text-white/40 truncate">{displaySong.artist}</div>
                                        </div>

                                        {/* Remove Button */}
                                        <GlassButton variant="ghost"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    const updated = await invoke<Playlist>("remove_from_playlist", {
                                                        playlistName: selectedPlaylist.name,
                                                        songPath: trackPath
                                                    });
                                                    setSelectedPlaylist(updated);
                                                    loadPlaylists(); // Refresh grid too
                                                } catch (err) {
                                                    console.error("Failed to remove track:", err);
                                                }
                                            }}
                                            className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Remove from playlist"
                                        >
                                            <IconTrash size={18} />
                                        </GlassButton>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* Create New */}
                    <form onSubmit={createPlaylist} className="mb-8 flex gap-2">
                        <GlassInput
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            placeholder="New Playlist Name..."
                            className="w-64"
                        />
                        <GlassButton
                            type="submit"
                            disabled={creating}
                        >
                            {creating ? "..." : "+ Create"}
                        </GlassButton>
                    </form>

                    {/* Grid */}
                    <div className="grid grid-cols-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {playlists.map((pl, idx) => (
                            <PlaylistCard
                                key={idx}
                                playlist={pl}
                                songs={songs}
                                onSelect={() => setSelectedPlaylist(pl)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function PlaylistCard({ playlist, songs, onSelect }: { playlist: Playlist, songs: Song[], onSelect: () => void }) {
    const { showConfirm } = useModal();
    const collage = useMemo(() => {
        const plSongs = playlist.tracks
            .map(t => songs.find(s => s.path === t))
            .filter(s => s && s.has_album_art) as Song[];

        // Randomize
        return [...plSongs].sort(() => 0.5 - Math.random()).slice(0, 4);
    }, [playlist.tracks.length, songs.length]); // Dependencies: only recalc if counts change to avoid frequent updates

    return (
        <GlassCard
            onClick={onSelect}
            className="group w-full cursor-pointer !p-3 flex flex-col hover:-translate-y-1 hover:border-white/20"
        >
            <div className="flex justify-between items-start mb-3 overflow-hidden rounded-lg relative shadow-inner group-hover:shadow-none transition-all">
                <div className="w-full aspect-square bg-neutral-900 grid grid-cols-2 grid-rows-2 relative">
                    {collage.length >= 4 ? (
                        collage.map((s, i) => (
                            <div key={i} className="overflow-hidden">
                                <AlbumArt song={s} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            </div>
                        ))
                    ) : collage.length > 0 ? (
                        <div className="col-span-2 row-span-2 overflow-hidden">
                            <AlbumArt song={collage[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        </div>
                    ) : (
                        <div className="col-span-2 row-span-2 flex items-center justify-center text-4xl text-white/20">
                            🎵
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center">
                <div className="flex-1 min-w-0 pr-2">
                    <GlassHeading as="h3" className="font-medium text-white/90 truncate text-sm px-1">{playlist.name}</GlassHeading>
                    <GlassText as="p" className="text-[10px] text-white/40 font-mono px-1">{playlist.tracks.length} tracks</GlassText>
                </div>
                <GlassButton variant="ghost"
                    onClick={async (e) => {
                        e.stopPropagation();
                        // Confirm?
                        if (await showConfirm(`Are you sure you want to delete playlist "${playlist.name}"?`, "Delete Playlist")) {
                            // We need to pass delete handler down
                            const customEvent = new CustomEvent('delete-playlist', { detail: playlist.name });
                            window.dispatchEvent(customEvent);
                        }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 text-white/30 hover:text-red-400 rounded transition-all"
                    title="Delete Playlist"
                >
                    <IconTrash size={14} />
                </GlassButton>
            </div>
        </GlassCard>
    );
}
