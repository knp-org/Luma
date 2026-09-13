import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueueEditor } from '../src/components/QueueEditor';
import type { Song } from '../src/models';

const queue: Song[] = ['A', 'B', 'C'].map(title => ({
    title, path: title, duration_seconds: 60, file_size_bytes: 1, has_album_art: false,
}));
beforeEach(() => {
    vi.stubGlobal('PointerEvent', class extends MouseEvent {
        pointerId = 1;
        isPrimary = true;
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperties(HTMLElement.prototype, {
        setPointerCapture: { configurable: true, value: vi.fn() },
        hasPointerCapture: { configurable: true, value: () => true },
        releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const row = this.dataset.queueRow;
        return new DOMRect(0, row === undefined ? 0 : Number(row) * 74, 400, row === undefined ? 222 : 68);
    });
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const method of ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture']) {
        Reflect.deleteProperty(HTMLElement.prototype, method);
    }
});
function setup() {
    const props = { queue, currentIndex: 1, onPlayIndex: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onSaved: vi.fn() };
    return { ...render(<QueueEditor {...props} />), props };
}
test('dragging down or up commits exactly once without starting playback', () => {
    const { props } = setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Drag A to reorder' }), { button: 0, clientX: 20, clientY: 34 });
    fireEvent.pointerMove(window, { clientX: 20, clientY: 182 });
    expect(props.onMove).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientX: 20, clientY: 182 });
    expect(props.onMove).toHaveBeenCalledExactlyOnceWith(0, 2);
    props.onMove.mockClear();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Drag C to reorder' }), { button: 0, clientX: 20, clientY: 182 });
    fireEvent.pointerUp(window, { clientX: 20, clientY: 34 });
    expect(props.onMove).toHaveBeenCalledExactlyOnceWith(2, 0);
    expect(props.onPlayIndex).not.toHaveBeenCalled();
});
test('Escape, cancelled pointers, and dropping outside leave the queue unchanged', () => {
    const { props } = setup();
    const handle = screen.getByRole('button', { name: 'Drag A to reorder' });
    for (const action of ['escape', 'cancel', 'outside']) {
        fireEvent.pointerDown(handle, { button: 0, clientX: 20, clientY: 34 });
        fireEvent.pointerMove(window, { clientX: 20, clientY: 182 });
        if (action === 'escape') fireEvent.keyDown(window, { key: 'Escape' });
        if (action === 'cancel') fireEvent.pointerCancel(window);
        fireEvent.pointerUp(window, { clientX: action === 'outside' ? 500 : 20, clientY: 182 });
    }
    expect(props.onMove).not.toHaveBeenCalled();
});
test('queue changes cancel an in-progress drag rather than moving a stale index', () => {
    const { props, rerender } = setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Drag A to reorder' }), { button: 0, clientX: 20, clientY: 34 });
    rerender(<QueueEditor {...props} queue={queue.slice(1)} />);
    fireEvent.pointerUp(window, { clientX: 20, clientY: 108 });
    expect(props.onMove).not.toHaveBeenCalled();
});
test('moving a row preserves its button and keyboard focus', () => {
    const { props, rerender } = setup();
    const button = screen.getByRole('button', { name: 'Move A down' });
    button.focus();
    fireEvent.click(button);
    expect(props.onMove).toHaveBeenCalledWith(0, 1);
    rerender(<QueueEditor {...props} queue={[queue[1], queue[0], queue[2]]} />);
    expect(screen.getByRole('button', { name: 'Move A down' })).toBe(button);
    expect(document.activeElement).toBe(button);
});
