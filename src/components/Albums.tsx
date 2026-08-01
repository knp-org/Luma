import { useState, useMemo, useEffect, useRef } from 'react';
import { Song } from '../types';
import { AlbumArt } from './AlbumArt';
import { GlassButton, GlassCard, GlassHeading, GlassText, GlassBadge, GlassSpinner } from '@knp-org/liquid-glass-ui';

interface AlbumsProps {
    songs: Song[];
    onPlaySong: (song: Song) => void;
}

interface AlbumGroup {
    name: string;
    artist: string;
    songs: Song[];
    heroSong: Song;
}

export function Albums({ songs, onPlaySong }: AlbumsProps) {
    const [selectedAlbum, setSelectedAlbum] = useState<AlbumGroup | null>(null);
    const [visibleCount, setVisibleCount] = useState(24);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const albums = useMemo(() => {
        const groups: Record<string, AlbumGroup> = {};

        songs.forEach(song => {
            const albumName = song.album || "Unknown Album";

            // Use parent directory to group albums. This handles compilations (same folder, diff artist)
            // and disambiguates same-named albums (diff folder)
            // Regex handles both / and \ just in case, though Linux is /
            const folderPath = song.path.substring(0, song.path.lastIndexOf('/'));

            // Key format: "Album Name|Folder Path"
            const key = `${albumName}|${folderPath}`;

            if (!groups[key]) {
                groups[key] = {
                    name: albumName,
                    artist: song.artist || "Unknown Artist", // Initial artist, will refine later
                    songs: [],
                    heroSong: song
                };
            }
            groups[key].songs.push(song);
        });

        // Refine artist names for groups
        Object.values(groups).forEach(group => {
            const artists = new Set(group.songs.map(s => s.artist).filter(Boolean));
            if (artists.size > 1) {
                group.artist = "Various Artists";
            }
        });

        // Sort albums by name
        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [songs]);

    // Intersection Observer for lazy loading
    useEffect(() => {
        if (!loadMoreRef.current || selectedAlbum) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && visibleCount < albums.length) {
                setVisibleCount(prev => prev + 24);
            }
        }, { threshold: 0.1 });

        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [visibleCount, albums.length, selectedAlbum]);

    // Reset scroll and visible count when leaving detail view
    const handleBack = () => {
        setSelectedAlbum(null);
    };

    if (selectedAlbum) {
        return (
            <div className="p-6 h-full flex flex-col animate-fade-in pb-24">
                <GlassButton
                    variant="ghost"
                    onClick={handleBack}
                    className="self-start text-sm text-white/50 hover:text-white mb-6 flex items-center gap-2 group transition-all"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Albums
                </GlassButton>

                <div className="flex items-end gap-8 mb-10">
                    <div className="w-56 h-56 bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-white/10 relative group shrink-0">
                        <AlbumArt song={selectedAlbum.heroSong} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                        <GlassHeading as="h1" className="text-5xl font-bold text-white mb-3 tracking-tight truncate pb-1">
                            {selectedAlbum.name}
                        </GlassHeading>
                        <GlassText as="p" className="text-xl text-white/60 font-medium">
                            {selectedAlbum.artist}
                        </GlassText>
                        <div className="mt-2">
                            <GlassBadge>{selectedAlbum.songs.length} Tracks</GlassBadge>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hidden">
                    <div className="grid grid-cols-1 gap-1">
                        {selectedAlbum.songs.sort((a, b) => (a.track_number || 0) - (b.track_number || 0)).map((song, idx) => (
                            <div
                                key={idx}
                                onClick={() => onPlaySong(song)}
                                className="flex items-center gap-4 p-3 text-white/80 hover:bg-white/5 rounded-xl cursor-pointer transition-all border border-transparent hover:border-white/5 group"
                            >
                                <div className="text-white/20 w-8 text-right font-mono text-sm group-hover:text-white/40 transition-colors">
                                    {(song.track_number || idx + 1).toString().padStart(2, '0')}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white group-hover:text-white transition-colors truncate">
                                        {song.title || song.path.split('/').pop()}
                                    </div>
                                    <div className="text-xs text-white/40 group-hover:text-white/60 transition-colors truncate">
                                        {song.artist}
                                    </div>
                                </div>
                                <div className="text-xs font-mono text-white/20 group-hover:text-white/40 transition-colors">
                                    {Math.floor(song.duration_seconds / 60)}:{String(Math.floor(song.duration_seconds) % 60).padStart(2, '0')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col animate-fade-in">
            <div className="flex items-center justify-between mb-8 pl-2">
                <GlassHeading as="h1" className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">Albums</GlassHeading>
                <GlassBadge>{albums.length} albums</GlassBadge>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 overflow-y-auto scrollbar-hidden pb-32">
                {albums.slice(0, visibleCount).map((album, idx) => (
                    <div
                        key={idx}
                        onClick={() => setSelectedAlbum(album)}
                        className="group flex flex-col cursor-pointer min-w-0"
                    >
                        <GlassCard width="100%" className="!p-0 aspect-square rounded-2xl mb-4 overflow-hidden border border-white/5 shadow-lg group-hover:shadow-2xl group-hover:shadow-black/50 transition-all group-hover:-translate-y-1 relative ring-1 ring-white/5 group-hover:ring-white/20">
                            <AlbumArt
                                song={album.heroSong}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                        </GlassCard>
                        <GlassHeading as="h3" className="font-semibold text-white/90 truncate text-sm px-1 group-hover:text-white transition-colors">
                            {album.name}
                        </GlassHeading>
                        <GlassText as="p" className="text-[11px] text-white/40 truncate px-1 group-hover:text-white/60 transition-colors">
                            {album.artist}
                        </GlassText>
                    </div>
                ))}
                {/* Sentinel for lazy loading */}
                {visibleCount < albums.length && (
                    <div ref={loadMoreRef} className="col-span-full h-20 flex items-center justify-center">
                        <GlassSpinner size={24} />
                    </div>
                )}
            </div>
        </div>
    );
}
