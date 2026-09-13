import React from 'react';
import { afterEach, test, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Library } from '../src/components/Library';
import type { Song } from '../src/models';
const artRender = vi.hoisted(() => vi.fn());
vi.mock('../src/components/AlbumArt', () => ({ AlbumArt: ({ song }: { song: Song }) => { artRender(song.path); return null; } }));
vi.mock('@knp-org/liquid-glass-ui', () => {
    const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
    const Icon = () => null;
    return { GlassButton: ({ children, onClick }: { children?: React.ReactNode; onClick?: React.MouseEventHandler }) => <button onClick={onClick}>{children}</button>,
        GlassSearch: ({ value, onChange }: { value: string; onChange: React.ChangeEventHandler<HTMLInputElement> }) => <input aria-label="Search" value={value} onChange={onChange} />,
        GlassHeading: Box, GlassText: Box, GlassEmptyState: Box, GlassBadge: Box, GlassSkeleton: Box,
        IconPlaySolid: Icon, IconMoreVertical: Icon, IconCheck: Icon, IconPause: Icon, IconInfo: Icon, IconPlus: Icon, IconMusicNote: Icon };
});
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const songs: Song[] = Array.from({ length: 5000 }, (_, i) => ({ path: `/music/${i}`, title: `Track ${i}`, duration_seconds: 60, file_size_bytes: 1, has_album_art: false }));
function props() {
    return { songs, loading: false, currentSong: songs[0], isPlaying: true, playlists: [], menuOpenFor: null,
        onPlaySong: vi.fn(), onQueue: vi.fn(), onMenuToggle: vi.fn(), onAddToPlaylist: vi.fn(), onShowSongInfo: vi.fn(), onGoToSettings: vi.fn() };
}
test('large libraries keep a bounded row count and play the full filtered collection', () => {
    const input = props();
    render(<Library {...input} />);
    expect(screen.getAllByRole('listitem').length).toBeLessThan(40);
    const scroll = screen.getByRole('list').parentElement!;
    fireEvent.scroll(scroll, { target: { scrollTop: 35000 } });
    expect(screen.getAllByRole('listitem').length).toBeLessThan(40);
    expect(screen.queryByText('Track 0')).toBeNull();
    fireEvent.click(screen.getByText('Track 500'));
    expect(input.onPlaySong).toHaveBeenCalledWith(songs[500], songs);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Track 4999' } });
    fireEvent.click(screen.getByText('Track 4999'));
    expect(input.onPlaySong).toHaveBeenLastCalledWith(songs[4999], [songs[4999]]);
});
test('rows skip unrelated rerenders while handlers use the latest props', () => {
    const input = props();
    const { rerender } = render(<Library {...input} />);
    artRender.mockClear();
    const onPlaySong = vi.fn();
    rerender(<Library {...input} onPlaySong={onPlaySong} />);
    expect(artRender).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Track 0'));
    expect(onPlaySong).toHaveBeenCalledWith(songs[0], songs);
});
