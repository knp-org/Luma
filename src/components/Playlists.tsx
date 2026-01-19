import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Playlist, Song } from '../types';
import { AlbumArt } from './AlbumArt';

interface PlaylistsProps {
    songs: Song[];
    onPlayPlaylist: (playlistSongs: Song[], startIndex?: number, shuffle?: boolean) => void;
}

export function Playlists({ songs, onPlayPlaylist }: PlaylistsProps) {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [creating, setCreating] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

    useEffect(() => {
        loadPlaylists();
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
            alert("Failed to create: " + e);
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
                <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">Your Playlists</h1>
                <p className="text-white/30 text-sm mt-1 font-light">{playlists.length} playlists</p>
            </div>

            {selectedPlaylist ? (
                <div className="flex-1 flex flex-col animate-fade-in pb-20">
                    <button
                        onClick={() => setSelectedPlaylist(null)}
                        className="self-start text-sm text-white/50 hover:text-white mb-4 flex items-center gap-2 group transition-all"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Playlists
                    </button>

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
                                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">{selectedPlaylist.name}</h1>
                                <p className="text-white/50 font-mono text-sm">{selectedPlaylist.tracks.length} Songs</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePlayContext(selectedPlaylist, 0, false)}
                                    className="px-6 py-2 bg-white text-black rounded-full font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-white/10"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                    Play
                                </button>
                                <button
                                    onClick={() => handlePlayContext(selectedPlaylist, 0, true)}
                                    className="px-6 py-2 bg-white/10 text-white rounded-full font-bold hover:bg-white/20 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                                    </svg>
                                    Shuffle
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-hidden">
                        {selectedPlaylist.tracks.length === 0 ? (
                            <div className="text-white/30 italic font-light">No songs in this playlist yet. Add them from your Library.</div>
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
                                        <button
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
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                                            </svg>
                                        </button>
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
                        <input
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            placeholder="New Playlist Name..."
                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/50 w-64 transition-all text-sm backdrop-blur-md"
                        />
                        <button
                            type="submit"
                            disabled={creating}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-all text-sm border border-white/5 hover:border-white/20"
                        >
                            {creating ? "..." : "+ Create"}
                        </button>
                    </form>

                    {/* Grid - Made smaller (cols-3 -> 4 -> 5) */}
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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

import { useMemo } from 'react';

function PlaylistCard({ playlist, songs, onSelect }: { playlist: Playlist, songs: Song[], onSelect: () => void }) {
    const collage = useMemo(() => {
        const plSongs = playlist.tracks
            .map(t => songs.find(s => s.path === t))
            .filter(s => s && s.has_album_art) as Song[];

        // Randomize
        return [...plSongs].sort(() => 0.5 - Math.random()).slice(0, 4);
    }, [playlist.tracks.length, songs.length]); // Dependencies: only recalc if counts change to avoid frequent updates

    return (
        <div
            onClick={onSelect}
            className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all cursor-pointer flex flex-col hover:shadow-2xl hover:shadow-black/50 hover:border-white/20 hover:-translate-y-1"
        >
            <div className="w-full aspect-square bg-neutral-900 rounded-lg mb-3 overflow-hidden grid grid-cols-2 grid-rows-2 relative shadow-inner">
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
            <h3 className="font-medium text-white/90 truncate text-sm px-1">{playlist.name}</h3>
            <p className="text-[10px] text-white/40 font-mono px-1">{playlist.tracks.length} tracks</p>
        </div>
    );
}
