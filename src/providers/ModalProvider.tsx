import { useState, useCallback } from 'react';
import { ModalContext } from '../context/ModalContext';
import { Modal } from '../components/Modal';

interface ModalState {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    resolve: (value: any) => void;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
    const [modal, setModal] = useState<ModalState | null>(null);

    // We use a ref to keep track of the current resolve function to avoid stale closures if needed,
    // though storing it in state directly as we do above is also fine for this simple case.

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
                <Modal
                    title={modal.title}
                    message={modal.message}
                    type={modal.type}
                    onConfirm={() => handleClose(true)}
                    onCancel={() => handleClose(false)} // Alert usually ignores this or treats as resolved(void)
                    confirmText="OK"
                    cancelText="Cancel"
                />
            )}
        </ModalContext.Provider>
    );
}
