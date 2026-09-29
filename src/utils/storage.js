/**
 * localStorage helpers that never throw: storage can be unavailable or hold corrupt values.
 * Values are stored as JSON; legacy plain-string values are returned as-is.
 */
export function readStorage(key, fallback) {
    try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    } catch {
        return fallback;
    }
}

export function writeStorage(key, value) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage full or unavailable; settings just won't persist
    }
}
