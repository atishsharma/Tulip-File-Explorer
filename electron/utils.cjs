// Pure helpers shared by the main process. Kept free of Electron imports so they can be unit tested.
const path = require('path');
const fs = require('fs').promises;

/**
 * Throw unless value is a non-empty absolute path without NUL bytes.
 */
function assertPath(value, label = 'path') {
    if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
        throw new Error(`Invalid ${label}`);
    }
    if (!path.isAbsolute(value)) {
        throw new Error(`Invalid ${label}: must be absolute`);
    }
    return value;
}

/**
 * Validate a single file/folder name (no separators, not "." / "..", not empty).
 * Returns an error message, or null when valid.
 */
function validateName(name, platform = process.platform) {
    if (typeof name !== 'string') return 'Name must be text';
    const trimmed = name.trim();
    if (!trimmed) return 'Name cannot be empty';
    if (trimmed === '.' || trimmed === '..') return 'Name cannot be "." or ".."';
    if (name.includes('\0') || name.includes('/')) return 'Name cannot contain "/"';
    if (platform === 'win32') {
        // eslint-disable-next-line no-control-regex
        if (/[<>:"\\|?*\x00-\x1f]/.test(name)) return 'Name cannot contain any of: \\ / : * ? " < > |';
        if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(trimmed)) return 'Name is reserved by Windows';
        if (/[. ]$/.test(name)) return 'Name cannot end with a space or period';
    }
    if (Buffer.byteLength(name) > 255) return 'Name is too long';
    return null;
}

/**
 * True when child equals parent or lives inside it.
 */
function isSubPath(parent, child, platform = process.platform) {
    const norm = (p) => {
        const resolved = path.resolve(p);
        return platform === 'win32' || platform === 'darwin' ? resolved.toLowerCase() : resolved;
    };
    const rel = path.relative(norm(parent), norm(child));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function exists(p) {
    try {
        await fs.lstat(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * Return a path in dir for baseName that does not exist yet: "name", "name (2)", "name (3)"...
 */
async function uniquePath(dir, baseName, existsFn = exists) {
    let candidate = path.join(dir, baseName);
    if (!(await existsFn(candidate))) return candidate;

    // Folders and dotfiles have no extension to preserve
    const ext = path.extname(baseName);
    const stem = ext && ext !== baseName ? baseName.slice(0, -ext.length) : baseName;
    const suffix = ext && ext !== baseName ? ext : '';
    for (let i = 2; i < 10000; i++) {
        candidate = path.join(dir, `${stem} (${i})${suffix}`);
        if (!(await existsFn(candidate))) return candidate;
    }
    throw new Error('Could not find a free name');
}

/**
 * Parse an ffprobe frame rate like "30000/1001" without eval.
 */
function parseFrameRate(value) {
    if (typeof value !== 'string') return undefined;
    const match = value.match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
    if (!match) return undefined;
    const num = parseFloat(match[1]);
    const den = match[2] ? parseFloat(match[2]) : 1;
    if (!den) return undefined;
    return Math.round((num / den) * 100) / 100;
}

/**
 * Allow only web and mail URLs to be handed to the OS.
 */
function isSafeExternalUrl(url) {
    try {
        const { protocol } = new URL(url);
        return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
    } catch {
        return false;
    }
}

/**
 * Reject a promise-returning call that takes longer than ms.
 */
function withTimeout(promise, ms, message = 'Operation timed out') {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

/**
 * Map over items with at most `limit` concurrent async calls, preserving order.
 */
async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

/**
 * Rclone remote names: letters, digits and _ - . + @ space; never "." or "..".
 */
function isValidRemoteName(name) {
    return typeof name === 'string'
        && /^[A-Za-z0-9_.\-+@ ]+$/.test(name)
        && name !== '.' && name !== '..'
        && name.trim() === name;
}

module.exports = {
    assertPath,
    validateName,
    isSubPath,
    exists,
    uniquePath,
    parseFrameRate,
    isSafeExternalUrl,
    withTimeout,
    mapLimit,
    isValidRemoteName,
};
