import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Song } from '../types';
import { AlbumArt } from './AlbumArt';
import {
    GlassCard,
    GlassStat,
    GlassMeter,
    GlassBadge,
    GlassDivider,
    GlassHeading,
    GlassText,
    GlassEmptyState,
    GlassSpinner,
    GlassTable,
    IconTrendingUp,
    IconTrendingDown,
    IconMusicNote,
} from '@knp-org/liquid-glass-ui';

interface SongPlayCount {
    path: string;
    count: number;
}

interface AnalyticsProps {
    songs: Song[];
    onPlaySong: (song: Song) => void;
}

type SongWithCount = Song & { playCount: number };

const UNKNOWN = 'Unknown';

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

/** Lossless vs lossy is inferred from the extension — the library has no codec field. */
function qualityOf(song: Song): 'hires' | 'lossless' | 'lossy' {
    const ext = song.path.split('.').pop()?.toLowerCase() ?? '';
    const isLossless = ['flac', 'wav', 'alac', 'aiff', 'aif', 'ape', 'wv'].includes(ext);
    if (!isLossless) return 'lossy';
    if ((song.sample_rate ?? 0) > 48000 || (song.bits_per_sample ?? 0) > 16) return 'hires';
    return 'lossless';
}

interface Rollup {
    key: string;
    plays: number;
    seconds: number;
    tracksOwned: number;
    tracksPlayed: number;
}

/** Group songs by a metadata field, summing plays and estimated listening time. */
function rollup(songs: SongWithCount[], keyOf: (s: SongWithCount) => string): Rollup[] {
    const map = new Map<string, Rollup>();
    for (const song of songs) {
        const key = keyOf(song) || UNKNOWN;
        let entry = map.get(key);
        if (!entry) {
            entry = { key, plays: 0, seconds: 0, tracksOwned: 0, tracksPlayed: 0 };
            map.set(key, entry);
        }
        entry.plays += song.playCount;
        entry.seconds += song.playCount * song.duration_seconds;
        entry.tracksOwned += 1;
        if (song.playCount > 0) entry.tracksPlayed += 1;
    }
    return [...map.values()].sort((a, b) => b.plays - a.plays || b.tracksOwned - a.tracksOwned);
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div>
            <GlassHeading as="h2" className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                {icon}
                {title}
            </GlassHeading>
            <GlassCard className="p-4">{children}</GlassCard>
        </div>
    );
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

    const songsWithCounts: SongWithCount[] = useMemo(() => {
        const countMap = new Map(stats.map(s => [s.path, s.count]));
        return songs.map(song => ({ ...song, playCount: countMap.get(song.path) || 0 }));
    }, [songs, stats]);

    const totals = useMemo(() => {
        let plays = 0, listenedSeconds = 0, librarySeconds = 0, bytes = 0, played = 0;
        for (const song of songsWithCounts) {
            plays += song.playCount;
            listenedSeconds += song.playCount * song.duration_seconds;
            librarySeconds += song.duration_seconds;
            bytes += song.file_size_bytes;
            if (song.playCount > 0) played += 1;
        }
        return {
            plays,
            listenedSeconds,
            librarySeconds,
            bytes,
            played,
            never: songsWithCounts.length - played,
            coverage: songsWithCounts.length > 0 ? (played / songsWithCounts.length) * 100 : 0,
        };
    }, [songsWithCounts]);

    const topArtists = useMemo(() => rollup(songsWithCounts, s => s.artist ?? ''), [songsWithCounts]);
    const topAlbums = useMemo(() => rollup(songsWithCounts, s => s.album ?? ''), [songsWithCounts]);
    const topGenres = useMemo(() => rollup(songsWithCounts, s => s.genre ?? ''), [songsWithCounts]);

    const decades = useMemo(() => {
        const map = new Map<number, number>();
        for (const song of songsWithCounts) {
            if (!song.year) continue;
            const decade = Math.floor(song.year / 10) * 10;
            map.set(decade, (map.get(decade) || 0) + 1);
        }
        return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([decade, tracks]) => ({ decade, tracks }));
    }, [songsWithCounts]);

    const quality = useMemo(() => {
        const buckets = { hires: 0, lossless: 0, lossy: 0 };
        for (const song of songsWithCounts) buckets[qualityOf(song)] += 1;
        const total = buckets.hires + buckets.lossless + buckets.lossy;
        return {
            total,
            rows: [
                { label: 'Hi-Res', tracks: buckets.hires },
                { label: 'Lossless', tracks: buckets.lossless },
                { label: 'Lossy', tracks: buckets.lossy },
            ],
        };
    }, [songsWithCounts]);

    const health = useMemo(() => {
        const missing = { artist: 0, album: 0, genre: 0, year: 0, art: 0, lyrics: 0 };
        for (const song of songsWithCounts) {
            if (!song.artist) missing.artist += 1;
            if (!song.album) missing.album += 1;
            if (!song.genre) missing.genre += 1;
            if (!song.year) missing.year += 1;
            if (!song.has_album_art) missing.art += 1;
            if (!song.lyrics) missing.lyrics += 1;
        }
        return missing;
    }, [songsWithCounts]);

    const mostPlayed = useMemo(
        () => [...songsWithCounts].filter(s => s.playCount > 0).sort((a, b) => b.playCount - a.playCount).slice(0, 10),
        [songsWithCounts]
    );

    // Only songs you've actually played — otherwise this is just 10 arbitrary
    // never-played tracks, which the "Never played" stat already counts.
    const leastPlayed = useMemo(
        () => [...songsWithCounts]
            .filter(s => s.playCount > 0)
            .sort((a, b) => a.playCount - b.playCount || (a.title ?? '').localeCompare(b.title ?? ''))
            .slice(0, 10),
        [songsWithCounts]
    );

    const maxArtistPlays = topArtists[0]?.plays ?? 0;
    const maxAlbumPlays = topAlbums[0]?.plays ?? 0;
    const maxGenrePlays = topGenres[0]?.plays ?? 0;
    const maxDecadeTracks = Math.max(0, ...decades.map(d => d.tracks));

    const songRow = (song: SongWithCount, i: number) => (
        <div
            key={song.path}
            className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            onClick={() => onPlaySong(song)}
        >
            <div className="text-2xl font-bold text-white/10 w-8 tabular-nums">{i + 1}</div>
            <AlbumArt song={song} className="w-12 h-12 rounded-lg" />
            <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{song.title || song.path.split('/').pop()}</div>
                <div className="text-sm text-white/40 truncate">{song.artist || UNKNOWN}</div>
            </div>
            <GlassBadge>{song.playCount} plays</GlassBadge>
        </div>
    );

    return (
        <div className="p-8 h-full overflow-y-auto pb-32">
            <GlassHeading as="h1" className="text-3xl font-bold text-white mb-1">Analytics</GlassHeading>
            <GlassText as="p" className="text-sm text-white/40 mb-8">
                Computed locally from your library — nothing leaves this machine.
            </GlassText>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <GlassSpinner size={40} />
                </div>
            ) : (
                <div className="space-y-10">
                    {/* Headline numbers */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <GlassStat
                            label="Listening time"
                            value={formatDuration(totals.listenedSeconds)}
                            sub={`${totals.plays.toLocaleString()} plays`}
                        />
                        <GlassStat
                            label="Library"
                            value={`${songsWithCounts.length.toLocaleString()} tracks`}
                            sub={`${formatDuration(totals.librarySeconds)} · ${formatSize(totals.bytes)}`}
                        />
                        <GlassStat
                            label="Coverage"
                            value={`${totals.coverage.toFixed(0)}%`}
                            sub={`${totals.played.toLocaleString()} of ${songsWithCounts.length.toLocaleString()} played`}
                        />
                        <GlassStat
                            label="Never played"
                            value={totals.never.toLocaleString()}
                            sub={totals.never > 0 ? 'Waiting to be discovered' : 'You have played everything'}
                        />
                    </div>

                    {/* Rollups */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-10">
                        <Section title="Top Artists">
                            {topArtists.slice(0, 10).map(artist => (
                                <GlassMeter
                                    key={artist.key}
                                    label={artist.key}
                                    value={artist.plays}
                                    max={maxArtistPlays}
                                    valueLabel={`${artist.plays.toLocaleString()} plays`}
                                    caption={`${artist.tracksPlayed}/${artist.tracksOwned} tracks · ${formatDuration(artist.seconds)}`}
                                />
                            ))}
                            {topArtists.length === 0 && (
                                <GlassEmptyState icon={<IconMusicNote size={36} />} title="No Artists" description="No artist metadata found" />
                            )}
                        </Section>

                        <Section title="Top Albums">
                            {topAlbums.slice(0, 10).map(album => (
                                <GlassMeter
                                    key={album.key}
                                    label={album.key}
                                    value={album.plays}
                                    max={maxAlbumPlays}
                                    valueLabel={`${album.plays.toLocaleString()} plays`}
                                    caption={`${album.tracksPlayed}/${album.tracksOwned} tracks`}
                                />
                            ))}
                            {topAlbums.length === 0 && (
                                <GlassEmptyState icon={<IconMusicNote size={36} />} title="No Albums" description="No album metadata found" />
                            )}
                        </Section>

                        <Section title="Top Genres">
                            {topGenres.slice(0, 8).map(genre => (
                                <GlassMeter
                                    key={genre.key}
                                    label={genre.key}
                                    value={genre.plays}
                                    max={maxGenrePlays}
                                    valueLabel={`${genre.plays.toLocaleString()} plays`}
                                    caption={`${genre.tracksOwned} tracks`}
                                />
                            ))}
                            {topGenres.length === 0 && (
                                <GlassEmptyState icon={<IconMusicNote size={36} />} title="No Genres" description="No genre metadata found" />
                            )}
                        </Section>

                        <Section title="Library Composition">
                            <GlassText as="p" className="text-xs text-white/40 mb-1">Audio quality</GlassText>
                            {quality.rows.map(row => (
                                <GlassMeter
                                    key={row.label}
                                    label={row.label}
                                    value={row.tracks}
                                    max={quality.total}
                                    valueLabel={`${row.tracks.toLocaleString()} tracks`}
                                    caption={`${quality.total > 0 ? ((row.tracks / quality.total) * 100).toFixed(0) : 0}% of library`}
                                />
                            ))}

                            <GlassDivider className="my-4" />

                            <GlassText as="p" className="text-xs text-white/40 mb-1">By decade</GlassText>
                            {decades.map(({ decade, tracks }) => (
                                <GlassMeter
                                    key={decade}
                                    label={`${decade}s`}
                                    value={tracks}
                                    max={maxDecadeTracks}
                                    valueLabel={`${tracks.toLocaleString()} tracks`}
                                />
                            ))}
                            {decades.length === 0 && (
                                <GlassText as="p" className="text-xs text-white/30 py-2">No year metadata found</GlassText>
                            )}
                        </Section>
                    </div>

                    {/* Track rankings */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-10">
                        <Section title="Top 10 Most Played" icon={<IconTrendingUp className="w-5 h-5 text-white/60" />}>
                            {mostPlayed.map(songRow)}
                            {mostPlayed.length === 0 && (
                                <GlassEmptyState icon={<IconTrendingUp size={36} />} title="No Plays" description="No plays recorded yet" />
                            )}
                        </Section>

                        <Section title="Least Played" icon={<IconTrendingDown className="w-5 h-5 text-white/60" />}>
                            {leastPlayed.map(songRow)}
                            {leastPlayed.length === 0 && (
                                <GlassEmptyState icon={<IconTrendingDown size={36} />} title="No Plays" description="Play something to see this list" />
                            )}
                        </Section>
                    </div>

                    {/* Metadata health */}
                    <Section title="Metadata Health">
                        <GlassTable
                            headers={['Field', 'Missing', 'Complete']}
                            rows={([
                                ['Artist', health.artist],
                                ['Album', health.album],
                                ['Genre', health.genre],
                                ['Year', health.year],
                                ['Album art', health.art],
                                ['Lyrics', health.lyrics],
                            ] as const).map(([label, missing]) => {
                                const complete = songsWithCounts.length - missing;
                                const pct = songsWithCounts.length > 0 ? (complete / songsWithCounts.length) * 100 : 0;
                                return [
                                    label,
                                    <span className="tabular-nums">{missing.toLocaleString()}</span>,
                                    <GlassBadge active={pct === 100}>{pct.toFixed(0)}%</GlassBadge>,
                                ];
                            })}
                        />
                    </Section>
                </div>
            )}
        </div>
    );
}
