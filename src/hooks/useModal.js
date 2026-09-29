import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Escape to close, Tab focus trap, and focus restore for modal dialogs.
 * Returns a ref for the dialog element.
 */
export function useModal(isOpen, onClose) {
    const dialogRef = useRef(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement;
        const dialog = dialogRef.current;

        if (dialog && !dialog.contains(document.activeElement)) {
            const first = dialog.querySelector('[autofocus]') || dialog.querySelector(FOCUSABLE) || dialog;
            first.focus?.();
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCloseRef.current?.();
                return;
            }
            if (e.key !== 'Tab' || !dialogRef.current) return;
            const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [isOpen]);

    return dialogRef;
}
