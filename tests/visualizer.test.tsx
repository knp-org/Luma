import React from 'react';
import { afterEach, test, expect, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { AudioVisualizer } from '../src/components/AudioVisualizer';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => ({ levels: Array(48).fill(0.5) })) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
test('caps drawing on high-refresh displays, reuses gradients, and stops after unmount', async () => {
    vi.useFakeTimers();
    const ctx = {
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        clearRect: vi.fn(), setTransform: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    let id = 0;
    const frames = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
    vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
    const { unmount } = render(<AudioVisualizer isPlaying volume={0.5} trackKey="one" />);
    await act(async () => {});
    const gradients = ctx.createLinearGradient.mock.calls.length;
    for (let i = 1; i <= 144; i++) {
        act(() => {
            const callbacks = [...frames.values()];
            frames.clear();
            callbacks.forEach(callback => callback(i * 1000 / 144));
        });
    }
    expect(ctx.clearRect.mock.calls.length).toBeGreaterThan(30);
    expect(ctx.clearRect.mock.calls.length).toBeLessThanOrEqual(60);
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(gradients);
    unmount();
    expect(frames.size).toBe(0);
    const requests = vi.mocked(invoke).mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(invoke).toHaveBeenCalledTimes(requests);
});
