import { useRef, useState } from 'react';
import { GlassBadge, GlassSlider } from '@knp-org/liquid-glass-ui';

export function formatTime(seconds: number) {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function PlayerSlider({ label, value, max, step = 1, onChange, formatValue, commitOnRelease = false, disabled = false }: {
    label: string; value: number; max: number; step?: number; onChange: (value: number) => void;
    formatValue: (value: number) => string; commitOnRelease?: boolean; disabled?: boolean;
}) {
    const dragging = useRef(false);
    const [draft, setDraft] = useState<number | null>(null);
    const [preview, setPreview] = useState<number | null>(null);
    const [focused, setFocused] = useState(false);
    const limit = Number.isFinite(max) && max > 0 ? max : 1;
    const current = Math.max(0, Math.min(limit, draft ?? (Number.isFinite(value) ? value : 0)));
    const tooltip = preview ?? (focused ? current : null);
    const inactive = disabled || max <= 0;
    return (
        <div className="luma-slider">
            <GlassSlider aria-label={label} aria-valuetext={formatValue(current)} min={0} max={limit} step={step}
                value={current} disabled={inactive}
                onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setPreview(null); }}
                onPointerMove={event => {
                    if (inactive) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left - 8) / Math.max(1, rect.width - 16)));
                    setPreview(Math.round(fraction * limit / step) * step);
                }}
                onPointerLeave={() => { if (!dragging.current) setPreview(null); }}
                onPointerDown={event => {
                    if (inactive || event.button !== 0) return;
                    dragging.current = true;
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                }}
                onPointerUp={event => {
                    if (!dragging.current) return;
                    dragging.current = false;
                    if (commitOnRelease) onChange(Number(event.currentTarget.value));
                    setDraft(null); setPreview(null);
                }}
                onPointerCancel={() => { dragging.current = false; setDraft(null); setPreview(null); }}
                onChange={event => {
                    const next = Number(event.target.value);
                    setPreview(next);
                    if (commitOnRelease && dragging.current) setDraft(next);
                    else onChange(next);
                }} />
            {tooltip !== null && !inactive && <span className="luma-slider-preview" aria-hidden="true"
                style={{ left: `${Math.max(8, Math.min(92, tooltip / limit * 100))}%` }}><GlassBadge>{formatValue(tooltip)}</GlassBadge></span>}
        </div>
    );
}

export function SeekSlider({ value, duration, onSeek }: { value: number; duration: number; onSeek: (value: number) => void }) {
    return <div className="luma-seek">
        <PlayerSlider label="Playback position" value={value} max={duration} onChange={onSeek} formatValue={formatTime} commitOnRelease />
        <div className="luma-seek-times"><span>{formatTime(value)}</span><span>{formatTime(duration)}</span></div>
    </div>;
}
