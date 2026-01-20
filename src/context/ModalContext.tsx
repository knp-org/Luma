import { createContext } from 'react';

export interface ModalContextType {
    showAlert: (message: string, title?: string) => Promise<void>;
    showConfirm: (message: string, title?: string) => Promise<boolean>;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);
