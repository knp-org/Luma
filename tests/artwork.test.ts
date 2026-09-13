import { test, expect, vi } from 'vitest';
import { ArtworkCache, artworkKey } from '../src/services/artwork';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
test('simultaneous artwork requests share a fetch and retry failures', async () => {
    const cache = new ArtworkCache();
    const fetch = vi.fn(async () => 'image');
    const [a, b] = await Promise.all([cache.load('a', fetch), cache.load('a', fetch)]);
    expect([a, b]).toEqual(['image', 'image']);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(cache.load('broken', async () => { throw Error('read failed'); })).rejects.toThrow();
    expect(await cache.load('broken', async () => 'recovered')).toBe('recovered');
});
test('cache evicts least recently used artwork within its byte budget', async () => {
    const cache = new ArtworkCache(12, 3);
    await cache.load('a', async () => 'aaa');
    await cache.load('b', async () => 'bbb');
    expect(cache.get('a')).toBe('aaa');
    await cache.load('c', async () => 'ccc');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('aaa');
    await cache.load('large', async () => 'too large to retain');
    expect(cache.get('large')).toBeUndefined();
    expect(cache.get('c')).toBe('ccc');
});
test('negative results are bounded and original art invalidates on file changes', async () => {
    const cache = new ArtworkCache(12, 2);
    for (const key of ['a', 'b', 'c']) await cache.load(key, async () => null);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeNull();
    const song = { path: 'a', duration_seconds: 10, file_size_bytes: 1, has_album_art: true, modified_at: 1 };
    expect(artworkKey(song)).not.toBe(artworkKey({ ...song, modified_at: 2 }));
});
