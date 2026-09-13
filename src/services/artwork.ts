import { invoke } from '@tauri-apps/api/core';
import type { Song } from '../models';

// Bound retained data URLs by both approximate string memory and entry count.
export class ArtworkCache {
    private entries = new Map<string, string | null>();
    private pending = new Map<string, Promise<string | null>>();
    private bytes = 0;
    constructor(private maxBytes = 32 * 1024 * 1024, private maxEntries = 256) {}
    get(key: string): string | null | undefined {
        const value = this.entries.get(key);
        if (value !== undefined) {
            this.entries.delete(key);
            this.entries.set(key, value);
        }
        return value;
    }
    load(key: string, fetch: () => Promise<string | null>): Promise<string | null> {
        const cached = this.get(key);
        if (cached !== undefined) return Promise.resolve(cached);
        const existing = this.pending.get(key);
        if (existing) return existing;
        const request = Promise.resolve().then(fetch).then(value => {
            const size = (value?.length ?? 0) * 2;
            if (size <= this.maxBytes) {
                this.entries.set(key, value);
                this.bytes += size;
                while (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) {
                    const oldest = this.entries.keys().next().value!;
                    this.bytes -= (this.entries.get(oldest)?.length ?? 0) * 2;
                    this.entries.delete(oldest);
                }
            }
            return value;
        }).finally(() => this.pending.delete(key));
        this.pending.set(key, request);
        return request;
    }
}
export const artworkCache = new ArtworkCache();
export function artworkKey(song: Song, original = false): string {
    return !original && song.cover_handle ? `thumb:${song.cover_handle}`
        : JSON.stringify(['original', song.path, song.modified_at, song.file_size_bytes]);
}
export function loadArtwork(song: Song, original = false) {
    const thumbnail = !original && song.cover_handle;
    return artworkCache.load(artworkKey(song, original), () => thumbnail
        ? invoke<string | null>('get_thumbnail', { handle: thumbnail })
        : invoke<string | null>('get_song_art', { path: song.path }));
}
