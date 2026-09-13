import { useState, useEffect, useRef } from 'react';
import { GlassCard, GlassButton, GlassInput , GlassHeading, GlassText} from '@knp-org/liquid-glass-ui';
import { IconTimer } from '@knp-org/liquid-glass-ui';

interface SleepTimerMenuProps {
    onClose: () => void;
    onSetTimer: (minutes: number, action: 'stop' | 'quit') => void;
    activeTimer: {
        endTime: number;
        action: 'stop' | 'quit';
        originalDuration?: number;
    } | null;
    onCancelTimer: () => void;
    currentSongDuration?: number;
    currentTime?: number;
    className?: string;
}

export function SleepTimerMenu({
    onClose,
    onSetTimer,
    activeTimer,
    onCancelTimer,
    currentSongDuration,
    currentTime,
    className = "bottom-24 right-8"
}: SleepTimerMenuProps) {
    const [customMinutes, setCustomMinutes] = useState('');
    const [action, setAction] = useState<'stop' | 'quit'>('stop');
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        return () => { if (previous?.isConnected) previous.focus(); };
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleQuickSet = (minutes: number) => {
        onSetTimer(minutes, action);
        onClose();
    };

    const handleCustomSet = () => {
        const mins = parseInt(customMinutes);
        if (!isNaN(mins) && mins > 0) {
            onSetTimer(mins, action);
            onClose();
        }
    };

    const handleEndOfSong = () => {
        if (currentSongDuration && currentTime !== undefined) {
            const remaining = Math.max(0, currentSongDuration - currentTime);
            // Convert seconds to minutes for consistency, or pass precise seconds?
            // The prop expects minutes, but for better precision we might want to handle it.
            // For now, let's pass minutes as float.
            onSetTimer(remaining / 60, action);
            onClose();
        }
    };

    return (
        <div ref={menuRef} role="dialog" aria-label="Sleep timer settings" onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}><GlassCard
            className={`absolute border border-white/10 p-4 w-64 shadow-2xl z-[100] animate-fade-in ${className}`}
        >
            <div className="flex items-center justify-between mb-4">
                <GlassHeading as="h3" className="text-white font-medium text-sm flex items-center gap-2">
                    <IconTimer size={16} />
                    Sleep Timer
                </GlassHeading>
                {activeTimer && (
                    <GlassButton variant="ghost"
                        onClick={() => { onCancelTimer(); onClose(); }}
                        className="text-xs !text-red-400 hover:!text-red-300 transition-colors"
                    >
                        Cancel
                    </GlassButton>
                )}
            </div>

            {/* Action Toggle */}
            <div className="flex gap-2 mb-4" role="group" aria-label="Timer action">
                <GlassButton variant={action === 'stop' ? 'primary' : 'secondary'} aria-pressed={action === 'stop'} onClick={() => setAction('stop')} className="flex-1" size="sm">Stop Music</GlassButton>
                <GlassButton variant={action === 'quit' ? 'primary' : 'secondary'} aria-pressed={action === 'quit'} onClick={() => setAction('quit')} className="flex-1" size="sm">Quit App</GlassButton>
            </div>

            {/* Quick Options */}
            <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[15, 30, 45, 60].map(mins => (
                    <GlassButton
                        key={mins}
                        variant="ghost"
                        onClick={() => handleQuickSet(mins)}
                        style={{ width: '100%', display: 'block', textAlign: 'center', borderRadius: '6px', fontSize: '12px', padding: '8px' }}
                        className="!bg-white/5 !border !border-white/10 hover:!bg-white/10 text-white/80 hover:text-white transition-all"
                    >
                        {mins} Minutes
                    </GlassButton>
                ))}

                <GlassButton
                    variant="ghost"
                    onClick={handleEndOfSong}
                    disabled={!currentSongDuration}
                    style={{ gridColumn: 'span 2', width: '100%', display: 'block', textAlign: 'center', borderRadius: '6px', fontSize: '12px', padding: '8px' }}
                    className="!bg-white/5 !border !border-white/10 hover:!bg-white/10 text-white/80 hover:text-white transition-all disabled:opacity-40"
                >
                    End of Song
                </GlassButton>
            </div>

            {/* Custom Time */}
            <div className="flex gap-2 items-stretch">
                <GlassInput
                    aria-label="Sleep timer minutes"
                    type="number"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Custom (min)"
                    containerClassName="flex-1"
                    className="w-full"
                    style={{ padding: '0.45rem 0.7rem', fontSize: '0.75rem', height: '100%' }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomSet()}
                />
                <GlassButton
                    variant="ghost"
                    onClick={handleCustomSet}
                    disabled={!customMinutes}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', fontSize: '12px', padding: '8px 16px' }}
                    className="font-bold uppercase tracking-wider !bg-white !text-black hover:!bg-white/90 transition-all disabled:opacity-40"
                >
                    Set
                </GlassButton>
            </div>

            {/* Active Status */}
            {activeTimer && (
                <div className="mt-4 pt-3 border-t border-white/10 text-center">
                    <GlassText as="p" className="text-xs text-white/65 mb-1">Timer Active</GlassText>
                    <GlassText as="p" className="text-sm font-mono text-white/80">
                        Ends in {Math.ceil((activeTimer.endTime - Date.now()) / 60000)} min
                    </GlassText>
                </div>
            )}
        </GlassCard></div>
    );
}
