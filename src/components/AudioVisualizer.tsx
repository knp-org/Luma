import { useEffect, useRef, useState } from 'react';
import { GlassBadge } from '@knp-org/liquid-glass-ui';
import { invoke } from '@tauri-apps/api/core';

const BANDS = 48;

interface AudioFrame {
    levels: number[];
}

interface AudioVisualizerProps {
    isPlaying: boolean;
    volume: number;
    trackKey: string;
}

export function readVisualizerPreference(): boolean {
    try {
        const saved = JSON.parse(localStorage.getItem('luma.visualizer') || 'null');
        // Retain the on/off preference from the earlier style selector.
        return saved?.enabled !== false;
    } catch {
        return true;
    }
}

function copySamples(target: Float32Array, values: unknown) {
    for (let i = 0; i < target.length; i++) {
        const value = Array.isArray(values) ? values[i] : 0;
        target[i] = typeof value === 'number' && Number.isFinite(value)
            ? Math.max(0, Math.min(1, value)) : 0;
    }
}

function createPalette(ctx: CanvasRenderingContext2D, height: number) {
    const baseline = height * 0.78;
    const silver = ctx.createLinearGradient(0, baseline, 0, 6);
    silver.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    silver.addColorStop(0.45, 'rgba(255, 255, 255, 0.72)');
    silver.addColorStop(1, '#ffffff');
    const reflection = ctx.createLinearGradient(0, baseline + 5, 0, height);
    reflection.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    reflection.addColorStop(1, 'rgba(255, 255, 255, 0)');
    return { silver, reflection };
}

function paint(
    ctx: CanvasRenderingContext2D, width: number, height: number,
    levels: Float32Array, peaks: Float32Array, palette: ReturnType<typeof createPalette>,
) {
    ctx.clearRect(0, 0, width, height);
    const step = width / BANDS;
    const baseline = height * 0.78;
    const maximum = Math.max(1, baseline - 10);
    const barWidth = Math.max(2, step * 0.48);
    const { silver, reflection } = palette;
    ctx.lineCap = 'round';
    ctx.lineWidth = barWidth;

    for (let i = 0; i < BANDS; i++) {
        const x = step * (i + 0.5);
        const level = levels[i];
        const bar = Math.max(1, level * maximum);
        ctx.strokeStyle = silver;
        ctx.globalAlpha = 0.45 + level * 0.55;
        ctx.beginPath();
        ctx.moveTo(x, baseline);
        ctx.lineTo(x, baseline - bar);
        ctx.stroke();

        // A quiet reflection grounds the bars without competing with the art.
        ctx.strokeStyle = reflection;
        ctx.globalAlpha = level;
        ctx.beginPath();
        ctx.moveTo(x, baseline + 5);
        ctx.lineTo(x, baseline + 5 + bar * 0.18);
        ctx.stroke();

        if (peaks[i] > 0.03) {
            const tip = baseline - peaks[i] * maximum - 4;
            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = Math.min(0.7, peaks[i] * 0.85);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x - (barWidth - 1.5) / 2, tip);
            ctx.lineTo(x + (barWidth - 1.5) / 2, tip);
            ctx.stroke();
            ctx.lineWidth = barWidth;
        }
    }
    ctx.globalAlpha = 1;
}

export function AudioVisualizer({ isPlaying, volume, trackKey }: AudioVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [unavailable, setUnavailable] = useState(false);
    const buffers = useRef({
        track: trackKey,
        levels: new Float32Array(BANDS),
        peaks: new Float32Array(BANDS),
    });
    const muted = volume <= 0;

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) {
            setUnavailable(true);
            return;
        }
        setUnavailable(false);
        const current = buffers.current;
        if (current.track !== trackKey) {
            current.track = trackKey;
            current.levels.fill(0);
            current.peaks.fill(0);
        }
        const targetLevels = new Float32Array(BANDS);
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let animation = 0;
        let pending = false;
        let lastFrame = 0;
        let width = 1;
        let height = 1;
        let palette = createPalette(ctx, height);

        function draw(now: number) {
            animation = 0;
            if (disposed || document.hidden) return;
            // Keep high-refresh monitors from multiplying canvas work.
            if (!motion.matches && lastFrame && now - lastFrame < 1000 / 60 - 0.25) {
                wake();
                return;
            }
            const dt = Math.min(64, Math.max(1, now - lastFrame || 16));
            lastFrame = now;
            let moving = false;
            for (let i = 0; i < BANDS; i++) {
                const speed = targetLevels[i] > current.levels[i] ? 48 : 170;
                const factor = motion.matches ? 1 : 1 - Math.exp(-dt / speed);
                current.levels[i] += (targetLevels[i] - current.levels[i]) * factor;
                if (current.levels[i] < 0.001) current.levels[i] = 0;
                current.peaks[i] = motion.matches ? current.levels[i]
                    : Math.max(current.levels[i], current.peaks[i] - dt / 1100);
                moving ||= current.peaks[i] > 0;
            }
            paint(ctx!, width, height, current.levels, current.peaks, palette);
            if (!motion.matches && moving) wake();
        }
        function wake() {
            if (!disposed && !document.hidden && !animation) animation = requestAnimationFrame(draw);
        }
        async function poll() {
            if (disposed || document.hidden || pending || !isPlaying || muted) return;
            pending = true;
            let delay = motion.matches ? 200 : 40;
            try {
                const frame = await invoke<AudioFrame>('get_spectrum');
                if (disposed || document.hidden) return;
                copySamples(targetLevels, frame?.levels);
                setUnavailable(false);
            } catch {
                if (disposed) return;
                targetLevels.fill(0);
                setUnavailable(true);
                delay = 2000;
            } finally {
                pending = false;
                if (!disposed && !document.hidden) {
                    wake();
                    timer = setTimeout(poll, delay);
                }
            }
        }
        function resize() {
            const rect = canvas!.getBoundingClientRect();
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            canvas!.width = Math.round(width * ratio);
            canvas!.height = Math.round(height * ratio);
            ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
            palette = createPalette(ctx!, height);
            wake();
        }
        function visibilityChanged() {
            clearTimeout(timer);
            cancelAnimationFrame(animation);
            animation = 0;
            targetLevels.fill(0);
            current.levels.fill(0);
            current.peaks.fill(0);
            if (!document.hidden) {
                lastFrame = 0;
                void poll();
                wake();
            }
        }
        function motionChanged() {
            clearTimeout(timer);
            void poll();
            wake();
        }
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        document.addEventListener('visibilitychange', visibilityChanged);
        motion.addEventListener('change', motionChanged);
        window.addEventListener('resize', resize);
        resize();
        void poll();
        return () => {
            disposed = true;
            clearTimeout(timer);
            cancelAnimationFrame(animation);
            observer.disconnect();
            document.removeEventListener('visibilitychange', visibilityChanged);
            motion.removeEventListener('change', motionChanged);
            window.removeEventListener('resize', resize);
        };
    }, [isPlaying, muted, trackKey]);

    return (
        <div id="player-visualizer" className="luma-visualizer">
            <canvas ref={canvasRef} aria-hidden="true" />
            {unavailable && <span className="luma-visualizer-status" role="status"><GlassBadge>Audio visualization unavailable</GlassBadge></span>}
        </div>
    );
}
