import { useState, useEffect, useRef } from 'react';

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
        <div
            ref={menuRef}
            className={`absolute bg-[#1a1a1a] border border-white/10 rounded-xl p-4 w-64 shadow-2xl z-[100] animate-fade-in ${className}`}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium text-sm flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                    Sleep Timer
                </h3>
                {activeTimer && (
                    <button
                        onClick={() => { onCancelTimer(); onClose(); }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                        Cancel
                    </button>
                )}
            </div>

            {/* Action Toggle */}
            <div className="bg-white/5 rounded-lg p-1 flex mb-4">
                <button
                    onClick={() => setAction('stop')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${action === 'stop'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-white/40 hover:text-white'
                        }`}
                >
                    Stop Music
                </button>
                <button
                    onClick={() => setAction('quit')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${action === 'quit'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-white/40 hover:text-white'
                        }`}
                >
                    Quit App
                </button>
            </div>

            {/* Quick Options */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                {[15, 30, 45, 60].map(mins => (
                    <button
                        key={mins}
                        onClick={() => handleQuickSet(mins)}
                        className="bg-white/5 hover:bg-white/10 text-white/80 hover:text-white py-2 rounded-lg text-xs transition-colors"
                    >
                        {mins} Minutes
                    </button>
                ))}

                <button
                    onClick={handleEndOfSong}
                    disabled={!currentSongDuration}
                    className="col-span-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white py-2 rounded-lg text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    End of Song
                </button>
            </div>

            {/* Custom Time */}
            <div className="flex gap-2">
                <input
                    type="number"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Custom (min)"
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomSet()}
                />
                <button
                    onClick={handleCustomSet}
                    disabled={!customMinutes}
                    className="px-4 bg-white text-black rounded-lg text-xs font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center justify-center uppercase tracking-wider"
                >
                    Set
                </button>
            </div>

            {/* Active Status */}
            {activeTimer && (
                <div className="mt-4 pt-3 border-t border-white/10 text-center">
                    <p className="text-xs text-white/40 mb-1">Timer Active</p>
                    <p className="text-sm font-mono text-blue-400">
                        Ends in {Math.ceil((activeTimer.endTime - Date.now()) / 60000)} min
                    </p>
                </div>
            )}
        </div>
    );
}
