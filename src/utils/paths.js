export const THIS_PC = 'thispc://';

/**
 * URL for streaming a local file through the app's tulip-file:// protocol.
 * Encodes the whole path so "#", "?", "%" and Windows backslashes survive.
 */
export function fileUrl(filePath) {
    return `tulip-file://local/${encodeURIComponent(filePath)}`;
}

function isWindowsPath(p) {
    return /^[a-zA-Z]:[\\/]?/.test(p) || p.startsWith('\\\\');
}

/**
 * Split a path into breadcrumb segments: [{ name, path }].
 */
export function splitPath(p) {
    if (!p || p === THIS_PC) return [];

    if (p.startsWith('\\\\')) {
        // UNC: \\server\share\rest -> root "\\server\share\"
        const parts = p.slice(2).split('\\').filter(Boolean);
        if (parts.length < 2) return [{ name: `\\\\${parts.join('\\')}`, path: p }];
        const root = `\\\\${parts[0]}\\${parts[1]}\\`;
        const segments = [{ name: `\\\\${parts[0]}\\${parts[1]}`, path: root }];
        for (let i = 2; i < parts.length; i++) {
            segments.push({ name: parts[i], path: root + parts.slice(2, i + 1).join('\\') });
        }
        return segments;
    }

    if (isWindowsPath(p)) {
        const parts = p.split(/[\\/]/).filter(Boolean);
        return parts.map((name, i) => ({
            name,
            path: i === 0 ? `${parts[0]}\\` : parts.slice(0, i + 1).join('\\'),
        }));
    }

    const parts = p.split('/').filter(Boolean);
    return parts.map((name, i) => ({ name, path: '/' + parts.slice(0, i + 1).join('/') }));
}

/**
 * True for "/", "C:\", "\\server\share\" and the virtual This PC path.
 */
export function isRootPath(p) {
    if (!p || p === THIS_PC || p === '/') return true;
    if (/^[a-zA-Z]:[\\/]?$/.test(p)) return true;
    if (p.startsWith('\\\\')) return p.slice(2).split('\\').filter(Boolean).length <= 2;
    return false;
}

/**
 * Parent folder of p, or null at a root.
 */
export function getParentPath(p) {
    if (isRootPath(p)) return null;
    const segments = splitPath(p);
    if (segments.length <= 1) return isWindowsPath(p) ? null : '/';
    return segments[segments.length - 2].path;
}
