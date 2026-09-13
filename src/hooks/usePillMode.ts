import { useCallback, useRef, useState } from 'react';
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition, type PhysicalSize } from '@tauri-apps/api/window';

interface WindowSnapshot {
    size: PhysicalSize;
    position: PhysicalPosition;
    maximized: boolean;
    fullscreen: boolean;
    resizable: boolean;
    alwaysOnTop: boolean;
}

export function usePillMode() {
    const saved = useRef<WindowSnapshot | null>(null);
    const changing = useRef(false);
    const activeRef = useRef(false);
    const [active, setActive] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const change = useCallback(async (enabled: boolean) => {
        if (changing.current) return false;
        if (activeRef.current === enabled && !saved.current) return true;
        changing.current = true;
        setBusy(true);
        setError('');
        const win = getCurrentWindow();
        const restore = async () => {
            const snapshot = saved.current;
            if (!snapshot) return;
            // Try every restoration step so a failed resize cannot leave the window pinned.
            const failures: unknown[] = [];
            const steps = [
                () => win.setResizable(true),
                () => win.setSize(snapshot.size),
                () => win.setPosition(snapshot.position),
                () => win.setResizable(snapshot.resizable),
                () => win.setAlwaysOnTop(snapshot.alwaysOnTop),
                ...(snapshot.maximized ? [() => win.maximize()] : []),
                ...(snapshot.fullscreen ? [() => win.setFullscreen(true)] : []),
            ];
            for (const step of steps) {
                try { await step(); } catch (cause) { failures.push(cause); }
            }
            if (failures.length) throw new Error(failures.map(String).join('; '));
            saved.current = null;
        };
        try {
            if (enabled) {
                if (activeRef.current) return true;
                const [size, position, maximized, fullscreen, resizable, alwaysOnTop, monitor] = await Promise.all([
                    win.innerSize(), win.outerPosition(), win.isMaximized(), win.isFullscreen(),
                    win.isResizable(), win.isAlwaysOnTop(), currentMonitor().catch(() => null),
                ]);
                saved.current = { size, position, maximized, fullscreen, resizable, alwaysOnTop };
                if (fullscreen) await win.setFullscreen(false);
                if (maximized) await win.unmaximize();
                await win.setResizable(true);
                await win.setSize(new LogicalSize(420, 80));
                if (monitor) {
                    const { position: origin, size: area } = monitor.workArea;
                    const scale = monitor.scaleFactor;
                    await win.setPosition(new PhysicalPosition(
                        Math.max(origin.x, origin.x + area.width - Math.round(436 * scale)),
                        Math.max(origin.y, origin.y + area.height - Math.round(96 * scale)),
                    ));
                }
                await win.setResizable(false);
                await win.setAlwaysOnTop(true);
            } else {
                await restore();
            }
            activeRef.current = enabled;
            setActive(enabled);
            return true;
        } catch (cause) {
            let detail = String(cause);
            if (enabled && saved.current) {
                try { await restore(); }
                catch (rollback) {
                    // Keep a restore control available if the native window is still small.
                    activeRef.current = true;
                    setActive(true);
                    detail += `; restore failed: ${String(rollback)}`;
                }
            }
            setError(`Could not ${enabled ? 'open' : 'restore from'} pill mode: ${detail}`);
            return false;
        } finally {
            changing.current = false;
            setBusy(false);
        }
    }, []);

    const enter = useCallback(() => change(true), [change]);
    const leave = useCallback(() => change(false), [change]);
    const clearError = useCallback(() => setError(''), []);
    return { active, busy, error, enter, leave, clearError };
}
