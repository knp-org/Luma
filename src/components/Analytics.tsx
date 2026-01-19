import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Song } from '../types';
import { AlbumArt } from './AlbumArt';

interface SongPlayCount {
    path: string;
    count: number;
}

interface AnalyticsProps {
    songs: Song[];
    onPlaySong: (song: Song) => void;
}

export function Analytics({ songs, onPlaySong }: AnalyticsProps) {
    const [stats, setStats] = useState<SongPlayCount[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    async function loadStats() {
        setLoading(true);
        try {
            const counts = await invoke<SongPlayCount[]>("get_play_stats");
            setStats(counts);
        } catch (e) {
            console.error("Failed to load analytics", e);
        }
        setLoading(false);
    }

    // Merge stats with song details
    // Map path -> count
    const countMap = new Map(stats.map(s => [s.path, s.count]));

    // Enrich songs with counts
    const songsWithCounts = songs.map(song => ({
        ...song,
        playCount: countMap.get(song.path) || 0
    }));

    // Sort by count descending for Most Played
    const mostPlayed = [...songsWithCounts].sort((a, b) => b.playCount - a.playCount).slice(0, 10);

    // Sort by count ascending for Least Played (filter out 0 plays if we want only "played at least once"? No, least played usually means 0 or low)
    // If user has many 0 plays, just showing first 10 is arbitrary.
    // Let's sort ascending.
    const leastPlayed = [...songsWithCounts].sort((a, b) => a.playCount - b.playCount).slice(0, 10);

    return (
        <div className="p-8 h-full overflow-y-auto">
            <h1 className="text-3xl font-bold text-white mb-8">Analytics</h1>

            {loading ? (
                <div className="text-white/50">Loading stats...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Most Played */}
                    <div>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            Top 10 Most Played
                        </h2>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            {mostPlayed.map((song, i) => (
                                <div
                                    key={song.path}
                                    className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer group"
                                    onClick={() => onPlaySong(song)}
                                >
                                    <div className="text-2xl font-bold text-white/10 w-8">{i + 1}</div>
                                    <AlbumArt song={song} className="w-12 h-12 rounded-lg" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-white truncate">{song.title}</div>
                                        <div className="text-sm text-white/40 truncate">{song.artist}</div>
                                    </div>
                                    <div className="text-white/60 font-mono font-medium bg-white/5 px-3 py-1 rounded-full text-xs">
                                        {song.playCount} plays
                                    </div>
                                </div>
                            ))}
                            {mostPlayed.length === 0 && <div className="text-white/30 text-center py-8">No plays yet</div>}
                        </div>
                    </div>

                    {/* Least Played */}
                    <div>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                            </svg>
                            Top 10 Least Played
                        </h2>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            {leastPlayed.map((song, i) => (
                                <div
                                    key={song.path}
                                    className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer group"
                                    onClick={() => onPlaySong(song)}
                                >
                                    <div className="text-2xl font-bold text-white/10 w-8">{i + 1}</div>
                                    <AlbumArt song={song} className="w-12 h-12 rounded-lg" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-white truncate">{song.title}</div>
                                        <div className="text-sm text-white/40 truncate">{song.artist}</div>
                                    </div>
                                    <div className="text-white/60 font-mono font-medium bg-white/5 px-3 py-1 rounded-full text-xs">
                                        {song.playCount} plays
                                    </div>
                                </div>
                            ))}
                            {leastPlayed.length === 0 && <div className="text-white/30 text-center py-8">No songs found</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
