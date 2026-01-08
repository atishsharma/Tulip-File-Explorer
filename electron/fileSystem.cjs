const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

/**
 * Get all special/common folders using Electron's app.getPath
 */
function getSpecialFolders(app) {
    const folders = [
        { id: 'home', name: 'Home', icon: 'home', path: app.getPath('home') },
        { id: 'desktop', name: 'Desktop', icon: 'desktop', path: app.getPath('desktop') },
        { id: 'documents', name: 'Documents', icon: 'documents', path: app.getPath('documents') },
        { id: 'downloads', name: 'Downloads', icon: 'downloads', path: app.getPath('downloads') },
        { id: 'pictures', name: 'Pictures', icon: 'pictures', path: app.getPath('pictures') },
        { id: 'videos', name: 'Videos', icon: 'videos', path: app.getPath('videos') },
        { id: 'music', name: 'Music', icon: 'music', path: app.getPath('music') },
    ];

    return folders;
}

/**
 * Get mounted drives based on platform
 */
async function getDrives() {
    const platform = os.platform();
    const drives = [];

    try {
        if (platform === 'win32') {
            // Windows: Check drive letters A-Z
            for (let i = 65; i <= 90; i++) {
                const driveLetter = String.fromCharCode(i) + ':';
                try {
                    await fs.access(driveLetter + '\\');
                    const stats = await getDriveStats(driveLetter + '\\');
                    drives.push({
                        name: driveLetter,
                        path: driveLetter + '\\',
                        ...stats,
                    });
                } catch {
                    // Drive not accessible
                }
            }
        } else if (platform === 'darwin') {
            // macOS: Read /Volumes
            const volumesPath = '/Volumes';
            try {
                const volumes = await fs.readdir(volumesPath);
                for (const volume of volumes) {
                    const volumePath = path.join(volumesPath, volume);
                    try {
                        const stats = await getDriveStats(volumePath);
                        drives.push({
                            name: volume,
                            path: volumePath,
                            ...stats,
                        });
                    } catch {
                        // Volume not accessible
                    }
                }
            } catch {
                // /Volumes not accessible
            }
        } else {
            // Linux: Read common mount points
            const mountPoints = ['/'];

            // Add /mnt mounts
            try {
                const mntDirs = await fs.readdir('/mnt');
                for (const dir of mntDirs) {
                    mountPoints.push(path.join('/mnt', dir));
                }
            } catch { }

            // Add /media mounts (including user subdirectories)
            try {
                const mediaDirs = await fs.readdir('/media');
                for (const dir of mediaDirs) {
                    const userMediaPath = path.join('/media', dir);
                    try {
                        const stat = await fs.stat(userMediaPath);
                        if (stat.isDirectory()) {
                            const userMounts = await fs.readdir(userMediaPath);
                            for (const mount of userMounts) {
                                mountPoints.push(path.join(userMediaPath, mount));
                            }
                        }
                    } catch { }
                }
            } catch { }

            for (const mountPoint of mountPoints) {
                try {
                    await fs.access(mountPoint);
                    const stats = await getDriveStats(mountPoint);
                    const name = mountPoint === '/' ? 'Root' : path.basename(mountPoint);
                    drives.push({
                        name,
                        path: mountPoint,
                        ...stats,
                    });
                } catch { }
            }
        }
    } catch (error) {
        console.error('Error getting drives:', error);
    }

    return drives;
}

/**
 * Get drive statistics (total/free space)
 */
async function getDriveStats(drivePath) {
    try {
        const platform = os.platform();

        if (platform === 'win32') {
            // On Windows, we'd need native modules or wmic
            return { total: null, free: null };
        } else {
            // Unix-like systems: use df command
            try {
                const output = execSync(`df -k "${drivePath}" 2>/dev/null | tail -1`, { encoding: 'utf8' });
                const parts = output.trim().split(/\s+/);
                if (parts.length >= 4) {
                    const total = parseInt(parts[1]) * 1024;
                    const used = parseInt(parts[2]) * 1024;
                    const free = parseInt(parts[3]) * 1024;
                    return { total, free, used };
                }
            } catch {
                return { total: null, free: null };
            }
        }
    } catch {
        return { total: null, free: null };
    }
    return { total: null, free: null };
}

/**
 * Read directory contents with file metadata
 */
async function readDirectory(dirPath) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const items = [];

        for (const entry of entries) {
            try {
                const fullPath = path.join(dirPath, entry.name);
                const stats = await fs.stat(fullPath);

                items.push({
                    name: entry.name,
                    path: fullPath,
                    isDirectory: entry.isDirectory(),
                    isFile: entry.isFile(),
                    isHidden: entry.name.startsWith('.'),
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                    created: stats.birthtime.toISOString(),
                    extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : null,
                });
            } catch (err) {
                // Skip files we can't access
                items.push({
                    name: entry.name,
                    path: path.join(dirPath, entry.name),
                    isDirectory: entry.isDirectory(),
                    isFile: entry.isFile(),
                    isHidden: entry.name.startsWith('.'),
                    size: 0,
                    modified: null,
                    created: null,
                    extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : null,
                    error: true,
                });
            }
        }

        // Sort: folders first, then alphabetically
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

/**
 * Get detailed file information
 */
async function getFileInfo(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return {
            success: true,
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            modified: stats.mtime.toISOString(),
            created: stats.birthtime.toISOString(),
            accessed: stats.atime.toISOString(),
            extension: stats.isFile() ? path.extname(filePath).toLowerCase() : null,
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    getSpecialFolders,
    getDrives,
    readDirectory,
    getFileInfo,
};
