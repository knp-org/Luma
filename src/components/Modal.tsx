import { useEffect } from 'react';

interface ModalProps {
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
}

export function Modal({ title, message, type, onConfirm, onCancel, confirmText = "OK", cancelText = "Cancel" }: ModalProps) {
    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onConfirm, onCancel]);

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={onCancel}
        >
            <div
                className="bg-neutral-900 border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-white/70 text-sm mb-6 leading-relaxed selection:bg-white/20">{message}</p>

                <div className="flex justify-end gap-3">
                    {type === 'confirm' && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors shadow-lg shadow-white/5"
                        autoFocus
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
