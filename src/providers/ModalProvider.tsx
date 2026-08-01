import { useState, useCallback } from 'react';
import { ModalContext } from '../context/ModalContext';
import { GlassModal, GlassButton } from '@knp-org/liquid-glass-ui';

interface ModalState {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    resolve: (value: any) => void;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
    const [modal, setModal] = useState<ModalState | null>(null);

    const showAlert = useCallback((message: string, title: string = "Alert") => {
        return new Promise<void>((resolve) => {
            setModal({
                isOpen: true,
                title,
                message,
                type: 'alert',
                resolve: () => resolve(),
            });
        });
    }, []);

    const showConfirm = useCallback((message: string, title: string = "Confirm") => {
        return new Promise<boolean>((resolve) => {
            setModal({
                isOpen: true,
                title,
                message,
                type: 'confirm',
                resolve: (val: boolean) => resolve(val),
            });
        });
    }, []);

    const handleClose = (result: boolean) => {
        if (modal) {
            modal.resolve(result); // true/false for confirm, void (ignored) for alert
            setModal(null);
        }
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {modal && (
                <GlassModal
                    isOpen={modal.isOpen}
                    onClose={() => handleClose(false)}
                    title={modal.title}
                    footer={
                        <div className="flex justify-end gap-3">
                            {modal.type === 'confirm' && (
                                <GlassButton onClick={() => handleClose(false)}>
                                    Cancel
                                </GlassButton>
                            )}
                            <GlassButton variant="primary" onClick={() => handleClose(true)}>
                                OK
                            </GlassButton>
                        </div>
                    }
                >
                    {modal.message}
                </GlassModal>
            )}
        </ModalContext.Provider>
    );
}
