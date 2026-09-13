import { load } from '@tauri-apps/plugin-store';
import type { PlaybackState, Song } from '../models';

type Checkpoint = Omit<PlaybackState, 'queue'> & { queueRevision: string };
type QueueRecord = { revision: string; queue: Song[] };
const defaults = { currentIndex: -1, currentTime: 0, volume: 0.5, isShuffle: false, loopMode: 'off' as const, isPlaying: false };

export class PlaybackStorage {
    private queueStore = load('playback-queue.json', { autoSave: false });
    private progressStore = load('playback-progress.json', { autoSave: false });
    private queue: Song[] | undefined;
    private revision = '';
    private checkpoint = '';
    private writes: Promise<void> = Promise.resolve();

    async restore(): Promise<PlaybackState | null> {
        const record = await (await this.queueStore).get<QueueRecord>('queue');
        if (record && Array.isArray(record.queue) && typeof record.revision === 'string') {
            this.queue = record.queue;
            this.revision = record.revision;
            const progress = await (await this.progressStore).get<Checkpoint>('checkpoint');
            if (progress?.queueRevision === record.revision) {
                this.checkpoint = JSON.stringify(progress);
                return { ...defaults, ...progress, queue: record.queue };
            }
            // A crash between the two saves must not apply an old position to a new queue.
            return { ...defaults, queue: record.queue, currentIndex: record.queue.length ? 0 : -1 };
        }
        const legacy = await load('playback-state.json', { autoSave: false });
        return (await legacy.get<PlaybackState>('luma_playback_state')) ?? null;
    }
    save(state: PlaybackState): Promise<void> {
        const snapshot = { ...state };
        const write = this.writes.catch(() => {}).then(async () => {
            if (this.queue !== snapshot.queue) {
                const revision = crypto.randomUUID();
                const store = await this.queueStore;
                await store.set('queue', { revision, queue: snapshot.queue });
                await store.save();
                this.queue = snapshot.queue;
                this.revision = revision;
            }
            const { queue: _queue, ...progress } = snapshot;
            const checkpoint: Checkpoint = { ...progress, queueRevision: this.revision };
            const serialized = JSON.stringify(checkpoint);
            if (serialized !== this.checkpoint) {
                const store = await this.progressStore;
                await store.set('checkpoint', checkpoint);
                await store.save();
                this.checkpoint = serialized;
            }
        });
        this.writes = write;
        return write;
    }
}
