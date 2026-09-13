import { useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { IconMusicNote } from '@knp-org/liquid-glass-ui';
import { artworkCache, artworkKey, loadArtwork } from '../services/artwork';

interface AlbumArtProps {
    song: Song;
    className?: string;
    placeholderContent?: React.ReactNode;
    useOriginal?: boolean;
    objectFit?: 'cover' | 'contain';
    smooth?: boolean;
}

function useArtwork(song: Song | null, original: boolean, enabled: boolean) {
    const key = song ? artworkKey(song, original) : '';
    const [result, setResult] = useState<{ key: string; art: string | null; failed: boolean } | null>(null);
    useEffect(() => {
        if (!song?.has_album_art || !enabled) return;
        let active = true;
        void loadArtwork(song, original).then(art => {
            if (active) setResult({ key, art, failed: !art });
        }).catch(() => {
            if (active) setResult({ key, art: null, failed: true });
        });
        return () => { active = false; };
    }, [key, song?.has_album_art, original, enabled]);
    if (!song?.has_album_art) return { art: null, failed: false };
    return result?.key === key ? result : { art: null, failed: false };
}

export function useSongArt(song: Song | null) {
    return useArtwork(song, false, true).art;
}

export function AlbumArt({ song, className, placeholderContent, useOriginal = false, objectFit = 'cover', smooth = false }: AlbumArtProps) {
    const key = artworkKey(song, useOriginal);
    const [visibleKey, setVisibleKey] = useState<string | null>(null);
    const imgRef = useRef<HTMLDivElement>(null);
    const { art, failed } = useArtwork(song, useOriginal, visibleKey === key);
    useEffect(() => {
        if (!song.has_album_art) return;
        if (artworkCache.get(key) !== undefined) {
            setVisibleKey(key);
            return;
        }
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setVisibleKey(key);
                observer.disconnect();
            }
        });
        if (imgRef.current) observer.observe(imgRef.current);
        return () => observer.disconnect();
    }, [key, song.has_album_art]);

    return (
        <div ref={imgRef} className={`${className} relative overflow-hidden bg-white/5`}>
            {!song.has_album_art || failed ? (
                <div className="w-full h-full flex items-center justify-center text-white/60">
                    {placeholderContent || <IconMusicNote size="40%" />}
                </div>
            ) : art ? (
                <img key={art} src={art} alt="" decoding="async" className={`w-full h-full ${objectFit === 'contain' ? 'object-contain' : 'object-cover'} ${smooth ? 'animate-art-in' : 'animate-fade-in'}`} />
            ) : <div className="w-full h-full animate-pulse bg-white/5" />}
        </div>
    );
}
