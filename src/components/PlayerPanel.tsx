import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GlassButton, GlassCard, IconX } from '@knp-org/liquid-glass-ui';

export function PlayerPanel({ tab, onTabChange, onClose, children }: {
    tab: 'queue' | 'lyrics'; onTabChange: (tab: 'queue' | 'lyrics') => void; onClose: () => void; children: ReactNode;
}) {
    const root = useRef<HTMLDivElement>(null);
    const id = useId();
    const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1099px)').matches);
    useEffect(() => {
        const query = window.matchMedia('(max-width: 1099px)');
        const update = () => setCompact(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        root.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
        return () => { if (previous?.isConnected) previous.focus(); };
    }, []);
    return <>
        <GlassButton variant="ghost" type="button" className="luma-panel-backdrop" tabIndex={-1} aria-label="Close player panel" onClick={onClose} />
        <div ref={root}><GlassCard className="luma-player-panel" role={compact ? 'dialog' : 'region'} aria-modal={compact || undefined} aria-label="Queue and lyrics"
            onKeyDown={event => {
                if (event.key !== 'Tab' || !compact) return;
                const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')];
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }}>
            <div className="luma-panel-heading">
                <div className="luma-panel-tabs" role="tablist" aria-label="Player panel">
                    {(['queue', 'lyrics'] as const).map(value => <GlassButton variant={tab === value ? "secondary" : "ghost"} key={value} id={`${id}-${value}`} type="button" role="tab"
                        aria-selected={tab === value} aria-controls={`${id}-content`} tabIndex={tab === value ? 0 : -1}
                        onClick={() => onTabChange(value)} onKeyDown={event => {
                            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                            event.preventDefault();
                            const next = event.key === 'Home' ? 'queue' : event.key === 'End' ? 'lyrics' : tab === 'queue' ? 'lyrics' : 'queue';
                            onTabChange(next);
                            document.getElementById(`${id}-${next}`)?.focus();
                        }}>{value === 'queue' ? 'Queue' : 'Lyrics'}</GlassButton>)}
                </div>
                <GlassButton type="button" shape="circle" variant="ghost" className="luma-icon-button" aria-label="Close player panel" title="Close player panel" onClick={onClose}><IconX size={18} /></GlassButton>
            </div>
            <div id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="luma-panel-body">{children}</div>
        </GlassCard></div>
    </>;
}
