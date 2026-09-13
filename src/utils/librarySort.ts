import type { Song } from '../models';
export type LibrarySort = 'default' | 'title' | 'artist' | 'album' | 'recent';
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const title = (song: Song) => song.title || song.path.split(/[\\/]/).pop() || song.path;
export function sortLibrary(songs: Song[], order: LibrarySort): Song[] {
    if (order === 'default') return songs;
    return [...songs].sort((a, b) => {
        if (order === 'recent') return (b.added_at ?? 0) - (a.added_at ?? 0) || collator.compare(title(a), title(b));
        if (order === 'artist') return collator.compare(a.artist || 'Unknown Artist', b.artist || 'Unknown Artist') || collator.compare(title(a), title(b));
        if (order === 'album') return collator.compare(a.album || 'Unknown Album', b.album || 'Unknown Album')
            || collator.compare(a.artist || '', b.artist || '') || (a.track_number ?? Infinity) - (b.track_number ?? Infinity) || collator.compare(title(a), title(b));
        return collator.compare(title(a), title(b));
    });
}
