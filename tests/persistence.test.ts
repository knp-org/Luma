import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { usePlaybackPersistence } from '../src/hooks/usePlaybackPersistence';
import { PlaybackStorage } from '../src/services/playbackStorage';
import { UsePlaybackPersistenceProps, Song, PlaybackState } from '../src/models';
const stores = vi.hoisted(() => {
    const make = () => ({ get: vi.fn(), set: vi.fn(), save: vi.fn() });
    return { queue: make(), progress: make(), legacy: make() };
});
vi.mock('@tauri-apps/plugin-store', () => ({ load: vi.fn(async (path: string) =>
    path === 'playback-queue.json' ? stores.queue : path === 'playback-progress.json' ? stores.progress : stores.legacy) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
const song: Song = { path: '/music/a.wav', duration_seconds: 100, file_size_bytes: 10, has_album_art: false };
function props(): UsePlaybackPersistenceProps {
    return { queue: [], currentIndex: -1, currentTime: 0, volume: 0.5, isShuffle: false, loopMode: 'off', isPlaying: false, setQueue: vi.fn(), setCurrentIndex: vi.fn(), setCurrentTime: vi.fn(), setVolume: vi.fn(), setIsShuffle: vi.fn(), setLoopMode: vi.fn() };
}
const state = (): PlaybackState => ({ queue: [song], currentIndex: 0, currentTime: 0, volume: 0.5, isShuffle: false, loopMode: 'off', isPlaying: true });
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
test('empty legacy queues still restore volume and migrate when saved', async () => {
    stores.legacy.get.mockResolvedValue({ queue: [], currentIndex: -1, volume: 0.8, isShuffle: false, loopMode: 'off' });
    const input = props();
    const { result } = renderHook(() => usePlaybackPersistence(input));
    await act(async () => {});
    expect(input.setVolume).toHaveBeenCalledWith(0.8);
    await act(async () => { await result.current.saveState(); });
    expect(stores.queue.set).toHaveBeenCalledWith('queue', expect.objectContaining({ queue: [] }));
    expect(stores.legacy.set).not.toHaveBeenCalled();
});
test('late restore does not overwrite a newly selected track', async () => {
    let finish: (value: unknown) => void = () => {};
    stores.legacy.get.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const input = props();
    const { rerender } = renderHook(input => usePlaybackPersistence(input), { initialProps: input });
    await act(async () => {});
    rerender({ ...input, queue: [song], currentIndex: 0, isPlaying: true });
    await act(async () => { finish({ queue: [{ ...song, path: '/music/old.wav' }], currentIndex: 0, volume: 0.2 }); });
    expect(input.setQueue).not.toHaveBeenCalled();
});
test('position checkpoints do not serialize or save the unchanged queue', async () => {
    const storage = new PlaybackStorage();
    const input = state();
    await storage.save(input);
    await storage.save({ ...input, currentTime: 5 });
    await storage.save({ ...input, currentTime: 10 });
    await storage.save({ ...input, currentTime: 10 });
    expect(stores.queue.set).toHaveBeenCalledTimes(1);
    expect(stores.queue.save).toHaveBeenCalledTimes(1);
    expect(stores.progress.save).toHaveBeenCalledTimes(3);
    expect(stores.progress.set.mock.calls[2][1]).not.toHaveProperty('queue');
    await storage.save({ ...input, queue: [], currentIndex: -1 });
    expect(stores.queue.save).toHaveBeenCalledTimes(2);
});
test('a mismatched checkpoint cannot seek into a newly saved queue', async () => {
    stores.queue.get.mockResolvedValue({ revision: 'new', queue: [song] });
    stores.progress.get.mockResolvedValue({ ...state(), queueRevision: 'old', currentTime: 99, currentIndex: 5 });
    const restored = await new PlaybackStorage().restore();
    expect(restored).toMatchObject({ queue: [song], currentTime: 0, currentIndex: 0 });
});
test('overlapping saves are serialized and recover after a disk error', async () => {
    const storage = new PlaybackStorage();
    const input = state();
    stores.queue.save.mockRejectedValueOnce(new Error('disk full'));
    const first = storage.save(input);
    const second = storage.save({ ...input, currentTime: 12 });
    await expect(first).rejects.toThrow('disk full');
    await second;
    expect(stores.queue.save).toHaveBeenCalledTimes(2);
    expect(stores.progress.set).toHaveBeenLastCalledWith('checkpoint', expect.objectContaining({ currentTime: 12 }));
});
