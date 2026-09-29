import { useState, useCallback, useRef } from 'react';

/**
 * Minimal toast queue. notify(message, type) where type is 'error' | 'success' | 'info'.
 */
export function useToasts(timeout = 5000) {
    const [toasts, setToasts] = useState([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const notify = useCallback((message, type = 'info') => {
        if (!message) return;
        const id = nextId.current++;
        setToasts((prev) => [...prev.slice(-4), { id, message: String(message), type }]);
        setTimeout(() => dismiss(id), type === 'error' ? timeout * 2 : timeout);
    }, [dismiss, timeout]);

    return { toasts, notify, dismiss };
}
