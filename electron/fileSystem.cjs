const fs = require('fs').promises;
const { constants: fsConstants } = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { withTimeout, mapLimit, exists } = require('./utils.cjs');

const execFileAsync = promisify(execFile);

// Stat calls on disconnected network or cloud drives can hang; never wait longer than this
const DRIVE_STAT_TIMEOUT = 2000;

/**
 * Get all special/common folders using Electron's app.getPath
 */
function getSpecialFolders(app) {
    return [
        { id: 'home', name: 'Home', icon: 'home', path: app.getPath('home') },
        { id: 'desktop', name: 'Desktop', icon: 'desktop', path: app.getPath('desktop') },
        { id: 'documents', name: 'Documents', icon: 'documents', path: app.getPath('documents') },
        { id: 'downloads', name: 'Downloads', icon: 'downloads', path: app.getPath('downloads') },
        { id: 'pictures', name: 'Pictures', icon: 'pictures', path: app.getPath('pictures') },
        { id: 'videos', name: 'Videos', icon: 'videos', path: app.getPath('videos') },
        { id: 'music', name: 'Music', icon: 'music', path: app.getPath('music') },
    ];
}

/**
 * Get drive statistics (total/free space) with a timeout so a stalled mount cannot block callers.
 */
async function getDriveStats(drivePath) {
    try {
        const stats = await withTimeout(fs.statfs(drivePath), DRIVE_STAT_TIMEOUT);
        return {
            total: stats.blocks * stats.bsize,
            free: stats.bavail * stats.bsize,
            used: (stats.blocks - stats.bfree) * stats.bsize,
        };
    } catch {
        return { total: null, free: null, used: null };
    }
}

async function getWindowsDrives() {
    // WMIC is removed on recent Windows builds; CIM via PowerShell returns labels as JSON
    try {
        const { stdout } = await execFileAsync('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-Command',
            'Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,Size,FreeSpace | ConvertTo-Json -Compress',
        ], { timeout: 5000, windowsHide: true });
        const parsed = JSON.parse(stdout || '[]');
        const disks = Array.isArray(parsed) ? parsed : [parsed];
        return disks
            .filter((d) => d && typeof d.DeviceID === 'string' && d.DeviceID.includes(':'))
            .map((d) => {
                const location = `${d.DeviceID}\\`;
                const size = Number(d.Size) || null;
                const free = d.FreeSpace == null ? null : Number(d.FreeSpace);
                return {
                    name: `${d.VolumeName || 'Local Disk'} (${location})`,
                    path: location,
                    total: size,
                    free,
                    used: size != null && free != null ? size - free : null,
                };
            });
    } catch {
        // Fallback: probe every letter in parallel, each bounded by a timeout
        const letters = Array.from({ length: 26 }, (_, i) => `${String.fromCharCode(65 + i)}:\\`);
        const probed = await Promise.all(letters.map(async (letter) => {
            try {
                await withTimeout(fs.access(letter), DRIVE_STAT_TIMEOUT);
                return { name: `Local Disk (${letter})`, path: letter, ...(await getDriveStats(letter)) };
            } catch {
                return null;
            }
        }));
        return probed.filter(Boolean);
    }
}

async function listSubdirs(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
    } catch {
        return [];
    }
}

/**
 * Get mounted drives based on platform
 */
async function getDrives() {
    const platform = os.platform();

    try {
        if (platform === 'win32') {
            return await getWindowsDrives();
        }

        let mountPoints;
        if (platform === 'darwin') {
            mountPoints = await listSubdirs('/Volumes');
        } else {
            // Linux: root, /mnt/*, /media/*, /media/<user>/*, /run/media/<user>/*
            mountPoints = ['/', ...(await listSubdirs('/mnt'))];
            for (const base of ['/media', '/run/media']) {
                for (const dir of await listSubdirs(base)) {
                    const children = await listSubdirs(dir);
                    // /media/<label> directly or /media/<user>/<label>
                    if (children.length > 0 && base === '/run/media') mountPoints.push(...children);
                    else if (children.length > 0 && path.basename(dir) === os.userInfo().username) mountPoints.push(...children);
                    else mountPoints.push(dir);
                }
            }
        }

        const drives = await Promise.all(mountPoints.map(async (mountPoint) => ({
            name: mountPoint === '/' ? 'Root' : path.basename(mountPoint),
            path: mountPoint,
            ...(await getDriveStats(mountPoint)),
        })));
        return drives;
    } catch (error) {
        console.error('Error getting drives:', error);
        return [];
    }
}

/**
 * Get "This PC" view (drives + special folders as items)
 */
async function getThisPCView(app) {
    const items = [];

    for (const folder of getSpecialFolders(app)) {
        try {
            const stats = await fs.stat(folder.path);
            items.push({
                name: folder.name,
                id: folder.id,
                path: folder.path,
                isDirectory: true,
                isFile: false,
                isSpecialFolder: true,
                icon: folder.icon,
                size: 0,
                modified: stats.mtime.toISOString(),
                created: stats.birthtime.toISOString(),
                extension: null,
            });
        } catch {
            // Folder not accessible, skip
        }
    }

    for (const drive of await getDrives()) {
        items.push({
            name: drive.name,
            path: drive.path,
            isDirectory: true,
            isFile: false,
            isDrive: true,
            size: drive.total,
            total: drive.total,
            free: drive.free,
            used: drive.used,
            modified: null,
            created: null,
            extension: null,
        });
    }

    return { success: true, items, path: 'thispc://' };
}

/**
 * Read directory contents with file metadata
 */
async function readDirectory(dirPath) {
    if (dirPath === 'thispc://') {
        return { success: false, error: 'Use getThisPCView for This PC path' };
    }

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        // Stat in parallel (bounded) so large or remote folders load quickly
        const items = await mapLimit(entries, 32, async (entry) => {
            const fullPath = path.join(dirPath, entry.name);
            const isSymlink = entry.isSymbolicLink();
            try {
                // stat follows symlinks so linked folders behave like folders
                const stats = await fs.stat(fullPath);
                const isDirectory = stats.isDirectory();
                return {
                    name: entry.name,
                    path: fullPath,
                    isDirectory,
                    isFile: !isDirectory,
                    isSymlink,
                    isHidden: entry.name.startsWith('.'),
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                    created: stats.birthtime.toISOString(),
                    extension: isDirectory ? null : path.extname(entry.name).toLowerCase(),
                };
            } catch {
                // Broken symlink or permission denied
                return {
                    name: entry.name,
                    path: fullPath,
                    isDirectory: entry.isDirectory(),
                    isFile: !entry.isDirectory(),
                    isSymlink,
                    isHidden: entry.name.startsWith('.'),
                    size: 0,
                    modified: null,
                    created: null,
                    extension: entry.isDirectory() ? null : path.extname(entry.name).toLowerCase(),
                    error: true,
                };
            }
        });

        items.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        return { success: true, items, path: dirPath };
    } catch (error) {
        return { success: false, error: error.message, path: dirPath };
    }
}

async function getWindowsHiddenAttribute(filePath) {
    try {
        const { stdout } = await execFileAsync('attrib', [filePath], { timeout: 5000, windowsHide: true });
        // Output is like: "A  H       C:\Path\To\File"; flags live before the path
        const idx = stdout.indexOf(filePath.slice(0, 2));
        const flags = idx > 0 ? stdout.slice(0, idx) : stdout.slice(0, 12);
        return flags.includes('H');
    } catch {
        return false;
    }
}

async function setWindowsHiddenAttribute(filePath, hide) {
    try {
        await execFileAsync('attrib', [hide ? '+h' : '-h', filePath], { timeout: 5000, windowsHide: true });
        return { success: true, newPath: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Recursive folder statistics. isCancelled() is polled so callers can abort long scans.
 */
async function calculateFolderStats(dirPath, isCancelled = () => false) {
    let size = 0;
    let files = 0;
    let folders = 0;

    async function traverse(currentPath) {
        if (isCancelled()) return;
        let entries;
        try {
            entries = await fs.readdir(currentPath, { withFileTypes: true });
        } catch {
            return; // Ignore inaccessible folders
        }

        const subdirs = [];
        await mapLimit(entries, 16, async (entry) => {
            if (isCancelled()) return;
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                folders++;
                subdirs.push(fullPath);
            } else if (entry.isFile()) {
                files++;
                try {
                    size += (await fs.stat(fullPath)).size;
                } catch { /* unreadable file */ }
            }
        });

        for (const dir of subdirs) {
            await traverse(dir);
        }
    }

    await traverse(dirPath);
    return { size, files, folders, cancelled: isCancelled() };
}

/**
 * Get unified content info for Properties dialog
 */
async function getContentInfo(itemPath) {
    try {
        const stats = await fs.stat(itemPath);
        const name = path.basename(itemPath) || itemPath;
        const isWindows = os.platform() === 'win32';

        const isHidden = isWindows ? await getWindowsHiddenAttribute(itemPath) : name.startsWith('.');

        let readOnly = false;
        try {
            await fs.access(itemPath, fsConstants.W_OK);
        } catch {
            readOnly = true;
        }

        const baseInfo = {
            name,
            path: itemPath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            isHidden,
            readOnly,
        };

        if (stats.isDirectory()) {
            return { ...baseInfo, type: 'folder', isDirectory: true };
        }
        return { ...baseInfo, type: 'file', isFile: true, extension: path.extname(itemPath).toLowerCase() };
    } catch (error) {
        // Might be a drive
        const drives = await getDrives();
        const key = itemPath.replace(/\\$/, '').toLowerCase();
        const drive = drives.find((d) => d.path.replace(/\\$/, '').toLowerCase() === key);
        if (drive) {
            return { ...drive, type: 'drive', isDrive: true, isDirectory: true };
        }
        return { error: error.message };
    }
}

async function setHiddenAttribute(itemPath, hide) {
    if (os.platform() === 'win32') {
        return setWindowsHiddenAttribute(itemPath, hide);
    }

    // Unix style: rename with "." prefix
    const dir = path.dirname(itemPath);
    const name = path.basename(itemPath);
    let newName = name;
    if (hide && !name.startsWith('.')) newName = '.' + name;
    else if (!hide && name.startsWith('.')) newName = name.substring(1);

    if (newName === name) return { success: true, newPath: itemPath };
    if (!newName) return { success: false, error: 'Cannot unhide a file named "."' };

    const newPath = path.join(dir, newName);
    if (await exists(newPath)) {
        return { success: false, error: `"${newName}" already exists` };
    }
    try {
        await fs.rename(itemPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    getSpecialFolders,
    getDrives,
    getDriveStats,
    readDirectory,
    getThisPCView,
    calculateFolderStats,
    getContentInfo,
    setHiddenAttribute,
};
