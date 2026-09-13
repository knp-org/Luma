import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { usePillMode } from '../src/hooks/usePillMode';

const win = vi.hoisted(() => ({
    innerSize: vi.fn(), outerPosition: vi.fn(), isMaximized: vi.fn(), isFullscreen: vi.fn(),
    isResizable: vi.fn(), isAlwaysOnTop: vi.fn(), setResizable: vi.fn(), setSize: vi.fn(),
    setPosition: vi.fn(), setAlwaysOnTop: vi.fn(), maximize: vi.fn(), unmaximize: vi.fn(), setFullscreen: vi.fn(),
}));
vi.mock('@tauri-apps/api/window', async importOriginal => ({
    ...await importOriginal<typeof import('@tauri-apps/api/window')>(),
    getCurrentWindow: () => win,
    currentMonitor: async () => ({ workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } }, scaleFactor: 1 }),
}));
beforeEach(() => {
    Object.values(win).forEach(mock => mock.mockReset().mockResolvedValue(undefined));
    win.innerSize.mockResolvedValue(new PhysicalSize(1180, 840));
    win.outerPosition.mockResolvedValue(new PhysicalPosition(100, 60));
    win.isMaximized.mockResolvedValue(false);
    win.isFullscreen.mockResolvedValue(false);
    win.isResizable.mockResolvedValue(true);
    win.isAlwaysOnTop.mockResolvedValue(false);
});
afterEach(cleanup);

test('pill mode shrinks and pins the window, then restores its original geometry and flags', async () => {
    const { result } = renderHook(() => usePillMode());
    await act(async () => { expect(await result.current.enter()).toBe(true); });
    expect(result.current.active).toBe(true);
    expect(win.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 420, height: 80, type: 'Logical' }));
    expect(win.setPosition).toHaveBeenLastCalledWith(new PhysicalPosition(1484, 984));
    expect(win.setResizable).toHaveBeenLastCalledWith(false);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true);
    await act(async () => { expect(await result.current.leave()).toBe(true); });
    expect(result.current.active).toBe(false);
    expect(win.setSize).toHaveBeenLastCalledWith(new PhysicalSize(1180, 840));
    expect(win.setPosition).toHaveBeenLastCalledWith(new PhysicalPosition(100, 60));
    expect(win.setResizable).toHaveBeenLastCalledWith(true);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
});

test('maximized/fullscreen and previously pinned windows recover their previous state', async () => {
    win.isMaximized.mockResolvedValue(true);
    win.isFullscreen.mockResolvedValue(true);
    win.isAlwaysOnTop.mockResolvedValue(true);
    win.isResizable.mockResolvedValue(false);
    const { result } = renderHook(() => usePillMode());
    await act(async () => { await result.current.enter(); });
    expect(win.unmaximize).toHaveBeenCalledOnce();
    expect(win.setFullscreen).toHaveBeenCalledWith(false);
    await act(async () => { await result.current.leave(); });
    expect(win.maximize).toHaveBeenCalledOnce();
    expect(win.setFullscreen).toHaveBeenLastCalledWith(true);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true);
    expect(win.setResizable).toHaveBeenLastCalledWith(false);
});

test('an entry failure rolls back the resized window and reports an error', async () => {
    win.setAlwaysOnTop.mockRejectedValueOnce(new Error('pin denied'));
    const { result } = renderHook(() => usePillMode());
    await act(async () => { expect(await result.current.enter()).toBe(false); });
    expect(result.current.active).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toContain('pin denied');
    expect(win.setSize).toHaveBeenLastCalledWith(new PhysicalSize(1180, 840));
    expect(win.setResizable).toHaveBeenLastCalledWith(true);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
});

test('a failed restore can be retried without losing the saved window position', async () => {
    const { result } = renderHook(() => usePillMode());
    await act(async () => { await result.current.enter(); });
    win.setPosition.mockRejectedValueOnce(new Error('temporary failure'));
    await act(async () => { expect(await result.current.leave()).toBe(false); });
    expect(result.current.active).toBe(true);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
    await act(async () => { expect(await result.current.leave()).toBe(true); });
    expect(result.current.active).toBe(false);
    expect(result.current.error).toBe('');
    expect(win.setPosition).toHaveBeenLastCalledWith(new PhysicalPosition(100, 60));
});

test('rapid repeated activation does not overwrite the original window snapshot', async () => {
    const { result } = renderHook(() => usePillMode());
    await act(async () => {
        const first = result.current.enter();
        expect(await result.current.enter()).toBe(false);
        expect(await first).toBe(true);
    });
    expect(win.innerSize).toHaveBeenCalledOnce();
    await act(async () => { await result.current.enter(); await result.current.leave(); });
    expect(win.innerSize).toHaveBeenCalledOnce();
    expect(win.setSize).toHaveBeenLastCalledWith(new PhysicalSize(1180, 840));
});
