import { useEffect, useRef, type PointerEvent, type RefObject } from 'react';
import type { Song } from '../models';

// Pointer capture keeps reordering inside the webview and avoids native drag images.
export function useQueueDrag(
    list: RefObject<HTMLDivElement | null>,
    queue: Song[],
    onMove: (from: number, to: number) => void,
) {
    const cancel = useRef<(() => void) | null>(null);
    const latest = useRef({ queue, onMove });
    latest.current = { queue, onMove };
    useEffect(() => () => cancel.current?.(), [queue]);

    return (event: PointerEvent<HTMLButtonElement>, from: number) => {
        const container = list.current;
        if (!container || event.button !== 0 || !event.isPrimary || queue.length < 2) return;
        cancel.current?.();
        event.preventDefault();
        const handle = event.currentTarget;
        handle.focus({ preventScroll: true });
        handle.setPointerCapture(event.pointerId);
        const pointerId = event.pointerId;
        const rows = [...container.querySelectorAll<HTMLElement>('[data-queue-row]')];
        const bounds = rows.map(row => row.getBoundingClientRect());
        const origin = bounds[from];
        if (!origin) { handle.releasePointerCapture(pointerId); return; }
        const startY = event.clientY;
        const startScroll = container.scrollTop;
        let x = event.clientX, y = startY, target = from;
        let active = false, frame = 0, previousTime = 0;
        let renderedTarget = from, renderedDelta = 0;
        const step = bounds.length > 1 ? bounds[1].top - bounds[0].top : origin.height;

        const update = (elapsed: number) => {
            if (!active) {
                if (Math.abs(y - startY) < 5) return;
                active = true;
                container.dataset.dragging = 'true';
                rows[from].dataset.dragActive = 'true';
            }
            const viewport = container.getBoundingClientRect();
            const inside = x >= viewport.left && x <= viewport.right && y >= viewport.top && y <= viewport.bottom;
            if (inside && elapsed > 0) {
                const edge = Math.min(56, viewport.height / 4);
                const speed = y < viewport.top + edge ? -(viewport.top + edge - y) / edge
                    : y > viewport.bottom - edge ? (y - viewport.bottom + edge) / edge : 0;
                container.scrollTop += speed * elapsed * 0.65;
            }
            const delta = Math.max(bounds[0].top - origin.top, Math.min(
                bounds[bounds.length - 1].bottom - origin.bottom,
                y - startY + container.scrollTop - startScroll,
            ));
            target = Math.max(0, Math.min(rows.length - 1,
                Math.round((origin.top + delta - bounds[0].top) / step),
            ));
            if (delta !== renderedDelta) {
                rows[from].style.transform = `translateY(${delta}px)`;
                renderedDelta = delta;
            }
            if (target !== renderedTarget) {
                rows.forEach((row, index) => {
                    if (index === from) return;
                    const shift = from < index && index <= target ? -step
                        : target <= index && index < from ? step : 0;
                    row.style.transform = `translateY(${shift}px)`;
                });
                renderedTarget = target;
            }
        };
        const animate = (time: number) => {
            update(previousTime ? Math.min(32, time - previousTime) : 0);
            previousTime = time;
            frame = requestAnimationFrame(animate);
        };
        const move = (e: globalThis.PointerEvent) => {
            if (e.pointerId === pointerId) { x = e.clientX; y = e.clientY; }
        };
        const cleanup = () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', drop);
            window.removeEventListener('pointercancel', abort);
            window.removeEventListener('keydown', escape, true);
            window.removeEventListener('blur', cleanup);
            handle.removeEventListener('lostpointercapture', cleanup);
            delete container.dataset.dragging;
            rows.forEach(row => { delete row.dataset.dragActive; row.style.removeProperty('transform'); });
            cancel.current = null;
            if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        };
        const drop = (e: globalThis.PointerEvent) => {
            if (e.pointerId !== pointerId) return;
            x = e.clientX; y = e.clientY;
            update(0);
            const viewport = container.getBoundingClientRect();
            const inside = x >= viewport.left && x <= viewport.right && y >= viewport.top && y <= viewport.bottom;
            cleanup();
            if (active && inside && queue === latest.current.queue && target !== from) {
                latest.current.onMove(from, target);
            }
        };
        const abort = (e: globalThis.PointerEvent) => { if (e.pointerId === pointerId) cleanup(); };
        const escape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cleanup(); }
        };
        cancel.current = cleanup;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', drop);
        window.addEventListener('pointercancel', abort);
        window.addEventListener('keydown', escape, true);
        window.addEventListener('blur', cleanup);
        handle.addEventListener('lostpointercapture', cleanup);
        frame = requestAnimationFrame(animate);
    };
}
