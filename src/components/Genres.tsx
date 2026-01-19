
import { useState, useMemo, useEffect, useRef } from 'react';
import { Song } from '../types';
import { AlbumArt } from './AlbumArt';

interface GenresProps {
    songs: Song[];
    onPlaySong: (song: Song) => void;
}

interface GenreGroup {
    name: string;
    songs: Song[];
    heroSong: Song;
}

export function Genres({ songs, onPlaySong }: GenresProps) {
    const [selectedGenre, setSelectedGenre] = useState<GenreGroup | null>(null);
    const [visibleCount, setVisibleCount] = useState(24);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const genres = useMemo(() => {
        const groups: Record<string, GenreGroup> = {};

        songs.forEach(song => {
            // Split genre string by commas or semicolons to handle multiple genres if needed
            // For now, let's treat the whole string as the genre.
            const genreName = song.genre ? song.genre.trim() : "Unknown Genre";

            // Clean up genre name (optional: capitalize, remove special chars?)
            // Keeping it simple for now.

            if (!groups[genreName]) {
                groups[genreName] = {
                    name: genreName,
                    songs: [],
                    heroSong: song, // We'll use the first song's art as the cover
                };
            }
            groups[genreName].songs.push(song);
        });

        // Use random art for genre cover? Or just the first one?
        // First one is fine for now.

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [songs]);

    // Intersection Observer for lazy loading
    useEffect(() => {
        if (!loadMoreRef.current || selectedGenre) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && visibleCount < genres.length) {
                setVisibleCount(prev => prev + 24);
            }
        }, { threshold: 0.1 });

        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [visibleCount, genres.length, selectedGenre]);

    const handleBack = () => {
        setSelectedGenre(null);
    };

    if (selectedGenre) {
        return (
            <div className="p-6 h-full flex flex-col animate-fade-in pb-24">
                <button
                    onClick={handleBack}
                    className="self-start text-sm text-white/50 hover:text-white mb-6 flex items-center gap-2 group transition-all"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Genres
                </button>

                <div className="flex items-end gap-8 mb-10">
                    <div className="w-56 h-56 bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-white/10 relative group shrink-0">
                        {/* 
                           We could use a collage of album arts here for a genre, 
                           but for simplicity, let's use the hero song's art 
                           with a distinct overlay or style.
                        */}
                        <AlbumArt song={selectedGenre.heroSong} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                        <div className="absolute bottom-4 left-4 right-4">
                            <span className="text-xs uppercase tracking-widest text-white/60">Genre</span>
                        </div>
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight truncate pb-1">
                            {selectedGenre.name}
                        </h1>
                        <p className="text-sm text-white/30 font-mono mt-2">
                            {selectedGenre.songs.length} Tracks
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hidden">
                    <div className="grid grid-cols-1 gap-1">
                        {selectedGenre.songs.sort((a, b) => (a.title || "").localeCompare(b.title || "")).map((song, idx) => (
                            <div
                                key={idx}
                                onClick={() => onPlaySong(song)}
                                className="flex items-center gap-4 p-3 text-white/80 hover:bg-white/5 rounded-xl cursor-pointer transition-all border border-transparent hover:border-white/5 group"
                            >
                                <div className="text-white/20 w-8 text-right font-mono text-sm group-hover:text-white/40 transition-colors">
                                    {(idx + 1).toString().padStart(2, '0')}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white group-hover:text-white transition-colors truncate">
                                        {song.title || song.path.split('/').pop()}
                                    </div>
                                    <div className="text-xs text-white/40 group-hover:text-white/60 transition-colors truncate">
                                        {song.artist} • {song.album}
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
            <h1 className="text-3xl font-bold text-white mb-8 tracking-tight drop-shadow-lg pl-2">Genres</h1>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 overflow-y-auto scrollbar-hidden pb-32">
                {genres.slice(0, visibleCount).map((genre, idx) => (
                    <div
                        key={idx}
                        onClick={() => setSelectedGenre(genre)}
                        className="group flex flex-col cursor-pointer"
                    >
                        <div className="aspect-square bg-neutral-900 rounded-2xl mb-4 overflow-hidden border border-white/5 shadow-lg group-hover:shadow-2xl group-hover:shadow-black/50 transition-all group-hover:-translate-y-1 relative ring-1 ring-white/5 group-hover:ring-white/20">
                            {/* Unsplash image or generate pattern for genre? 
                                Using hero song art for now, heavily styled.
                            */}
                            <AlbumArt
                                song={genre.heroSong}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                {/* Optional: Genre Icon Overlay */}
                            </div>
                        </div>
                        <h3 className="font-semibold text-white/90 truncate text-sm px-1 group-hover:text-white transition-colors">
                            {genre.name}
                        </h3>
                        <p className="text-[11px] text-white/40 truncate px-1 group-hover:text-white/60 transition-colors">
                            {genre.songs.length} Songs
                        </p>
                    </div>
                ))}
                {visibleCount < genres.length && (
                    <div ref={loadMoreRef} className="col-span-full h-20 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
        </div>
    );
}
