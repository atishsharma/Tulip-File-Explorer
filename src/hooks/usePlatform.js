import { useState, useEffect } from 'react';

let cached = null;
let pending = null;

/**
 * The OS platform ('win32' | 'darwin' | 'linux'), fetched once and shared by every caller.
 */
export function usePlatform() {
    const [platform, setPlatform] = useState(cached);

    useEffect(() => {
        if (cached || !window.electronAPI) return;
        pending = pending || window.electronAPI.getPlatform().then((p) => {
            cached = p;
            return p;
        });
        pending.then(setPlatform);
    }, []);

    return platform;
}

/**
 * Name of the virtual "all drives" location on each OS.
 */
export function computerName(platform) {
    if (platform === 'darwin') return 'This Mac';
    if (platform === 'linux') return 'This Computer';
    return 'This PC';
}
