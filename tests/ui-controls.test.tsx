import React from 'react';
import { afterEach, test, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlayerSlider, formatTime } from '../src/components/PlayerSlider';
import { PlayerPanel } from '../src/components/PlayerPanel';
import { sortLibrary } from '../src/utils/librarySort';
import type { Song } from '../src/models';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
test('seek dragging previews locally, commits once, and keyboard changes commit directly', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const onChange = vi.fn();
    render(<PlayerSlider label="Position" value={0} max={120} onChange={onChange} formatValue={formatTime} commitOnRelease />);
    const slider = screen.getByRole('slider', {name:'Position'});
    fireEvent.pointerDown(slider, {button:0});
    fireEvent.change(slider, {target:{value:'45'}});
    fireEvent.change(slider, {target:{value:'65'}});
    expect(onChange).not.toHaveBeenCalled();
    expect(slider.getAttribute('aria-valuetext')).toBe('1:05');
    fireEvent.pointerUp(slider, {button:0});
    expect(onChange).toHaveBeenCalledExactlyOnceWith(65);
    fireEvent.change(slider, {target:{value:'70'}});
    expect(onChange).toHaveBeenLastCalledWith(70);
});
test('a cancelled seek does not move playback', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const onChange = vi.fn();
    render(<PlayerSlider label="Position" value={20} max={120} onChange={onChange} formatValue={formatTime} commitOnRelease />);
    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider, {button:0});
    fireEvent.change(slider, {target:{value:'80'}});
    fireEvent.pointerCancel(slider);
    expect(onChange).not.toHaveBeenCalled();
    expect(slider.getAttribute('aria-valuetext')).toBe('0:20');
});
test('panel tabs switch with arrow keys and restore focus on close', () => {
    vi.stubGlobal('matchMedia', () => ({matches:true, addEventListener(){}, removeEventListener(){}}));
    const change = vi.fn();
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const {unmount} = render(<PlayerPanel tab="queue" onTabChange={change} onClose={() => {}}>Content</PlayerPanel>);
    expect(document.activeElement).toBe(screen.getByRole('tab', {name:'Queue'}));
    fireEvent.keyDown(screen.getByRole('tab', {name:'Queue'}), {key:'ArrowRight'});
    expect(change).toHaveBeenCalledWith('lyrics');
    expect(document.activeElement).toBe(screen.getByRole('tab', {name:'Lyrics'}));
    act(() => unmount());
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
});
test('library sorting handles numeric titles, album track order, dates, and leaves input unchanged', () => {
    const songs: Song[] = [
        {path:'b', title:'Song 10', artist:'Z', album:'Album', track_number:2, added_at:2},
        {path:'a', title:'Song 2', artist:'Z', album:'Album', track_number:1, added_at:3},
        {path:'c', title:'Song 3', artist:'A', album:'Other', added_at:1},
    ].map(song => ({...song, duration_seconds:100,file_size_bytes:1,has_album_art:false}));
    expect(sortLibrary(songs,'title').map(song => song.path)).toEqual(['a','c','b']);
    expect(sortLibrary(songs,'artist')[0].path).toBe('c');
    expect(sortLibrary(songs,'album').map(song => song.path)).toEqual(['a','b','c']);
    expect(sortLibrary(songs,'recent').map(song => song.path)).toEqual(['a','b','c']);
    expect(songs.map(song => song.path)).toEqual(['b','a','c']);
});
