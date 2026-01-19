import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Song } from '../types';

// Simple memory cache to avoid re-fetching same art
const artCache = new Map<string, string>();

interface AlbumArtProps {
    song: Song;
    className?: string;
    placeholderContent?: React.ReactNode;
    useOriginal?: boolean;
    objectFit?: "cover" | "contain";
}

// Export hook for other components to use
export function useSongArt(song: Song | null) {
    const [art, setArt] = useState<string | null>(null);

    useEffect(() => {
        if (!song || !song.has_album_art) {
            setArt(null);
            return;
        }

        const cacheKey = song.cover_handle || song.path;
        if (artCache.has(cacheKey)) {
            setArt(artCache.get(cacheKey)!);
            return;
        }

        let active = true;
        const command = song.cover_handle ? 'get_thumbnail' : 'get_song_art';
        const params = song.cover_handle ? { handle: song.cover_handle } : { path: song.path };

        invoke<string | null>(command, params)
            .then(fetchedArt => {
                if (active && fetchedArt) {
                    artCache.set(cacheKey, fetchedArt);
                    setArt(fetchedArt);
                }
            })
            .catch(console.error);

        return () => { active = false; };
    }, [song?.path, song?.cover_handle, song?.has_album_art]);

    return art;
}

export function AlbumArt({ song, className, placeholderContent, useOriginal = false, objectFit = "cover" }: AlbumArtProps) {
    const [src, setSrc] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    // Cache key distinct for original vs thumbnail
    const baseKey = song.cover_handle || song.path;
    const cacheKey = useOriginal ? `${baseKey}_full` : baseKey;

    useEffect(() => {
        if (artCache.has(cacheKey)) {
            setSrc(artCache.get(cacheKey)!);
            setIsVisible(true);
            setHasError(false);
            return;
        }

        // Reset state for new song
        setSrc(null);
        setHasError(false);
        setIsVisible(false);

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        });

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, [cacheKey]);

    useEffect(() => {
        if (!isVisible || !song.has_album_art || src || hasError) return;

        let active = true;

        // If useOriginal is true, FORCE 'get_song_art' (original resolution)
        // If useOriginal is false, prefer 'get_thumbnail' if handle exists
        const command = (useOriginal || !song.cover_handle) ? 'get_song_art' : 'get_thumbnail';
        const params = (useOriginal || !song.cover_handle) ? { path: song.path } : { handle: song.cover_handle };

        invoke<string | null>(command, params)
            .then(art => {
                if (active) {
                    if (art) {
                        artCache.set(cacheKey, art);
                        setSrc(art);
                    } else {
                        setHasError(true);
                    }
                }
            })
            .catch(err => {
                console.error("Failed to load art:", err);
                if (active) setHasError(true);
            });

        return () => { active = false; };
    }, [isVisible, cacheKey, song.has_album_art, src, hasError, useOriginal, song.path, song.cover_handle]);

    if (!song.has_album_art || hasError) {
        return (
            <div className={`${className} flex items-center justify-center bg-white/5 text-white/20`}>
                {placeholderContent || (
                    <svg width="40%" height="40%" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v9.28a4.39 4.39 0 00-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
                    </svg>
                )}
            </div>
        );
    }

    return (
        <div ref={imgRef} className={`${className} relative overflow-hidden bg-white/5`}>
            {src ? (
                <img src={src} alt="" className={`w-full h-full ${objectFit === "contain" ? "object-contain" : "object-cover"} animate-fade-in`} />
            ) : (
                <div className="w-full h-full animate-pulse bg-white/5" />
            )}
        </div>
    );
}

