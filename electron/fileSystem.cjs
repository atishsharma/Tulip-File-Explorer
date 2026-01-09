const fs = require('fs').promises;
const fsOriginal = require('fs'); // Import original fs for callback-based methods if needed
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');
const execAsync = promisify(exec);

// Promisify statfs if available (Node 19.6+), or use fs.statfs from callback API, or null
const statfs = fs.statfs || (fsOriginal.statfs ? promisify(fsOriginal.statfs) : null);

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

// Feature flag for WMIC (will be disabled if it fails)
let useWmic = true;

/**
 * Get mounted drives based on platform
 */
async function getDrives() {
    const platform = os.platform();
    const drives = [];

    try {
        if (platform === 'win32') {
            // Windows: Use WMIC to get all drives with labels in one go (non-blocking)
            // User requested to use WMIC if it works.
            try {
                // Fetch Caption (Letter), VolumeName (Label), Size, FreeSpace
                const { stdout } = await execAsync('wmic logicaldisk get Caption,VolumeName,Size,FreeSpace /format:csv');
                const lines = stdout.trim().split('\n').filter(line => line.trim() && !line.startsWith('Node'));

                for (const line of lines) {
                    const parts = line.split(',');
                    // Format output is Node,Caption,FreeSpace,Size,VolumeName

                    if (parts.length >= 5) {
                        const caption = parts[1]; // C:
                        const free = parseInt(parts[2]) || 0;
                        const size = parseInt(parts[3]) || 0;
                        const label = parts[4].trim(); // VolumeName

                        if (caption && caption.includes(':')) {
                            // "Name (Location)" -> "VolumeName (C:\)"
                            const location = caption + '\\';
                            const displayName = label || 'Local Disk';

                            drives.push({
                                name: `${displayName} (${location})`,
                                path: location,
                                total: size,
                                free: free,
                                used: size - free
                            });
                        }
                    }
                }
            } catch (err) {
                // Fallback to simple A-Z check if WMIC fails
                for (let i = 65; i <= 90; i++) {
                    const driveLetter = String.fromCharCode(i) + ':';
                    try {
                        await fs.access(driveLetter + '\\');
                        const stats = await getDriveStats(driveLetter + '\\');

                        // Fallback format
                        drives.push({
                            name: `Local Disk (${driveLetter}\\)`,
                            path: driveLetter + '\\',
                            ...stats,
                        });
                    } catch { }
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
 * Uses native non-blocking fs.statfs if available
 */
async function getDriveStats(drivePath) {
    try {
        if (statfs) {
            const stats = await statfs(drivePath);
            return {
                total: stats.blocks * stats.bsize,
                free: stats.bfree * stats.bsize,
                used: (stats.blocks - stats.bfree) * stats.bsize
            };
        } else {
            // Fallback if statfs is not available (older Node versions)
            // Return nulls to avoid blocking/crashing with execSync
            console.warn('fs.statfs not available, drive stats skipped');
            return { total: null, free: null, used: null };
        }
    } catch (error) {
        // console.error(`Failed to get stats for ${drivePath}:`, error.message);
        return { total: null, free: null, used: null };
    }
}

/**
 * Get "This PC" view for Windows (drives + special folders as items)
 */
async function getThisPCView(app) {
    // Enabled for all platforms
    const items = [];

    // Add special folders first
    const specialFolders = getSpecialFolders(app);
    for (const folder of specialFolders) {
        try {
            const stats = await fs.stat(folder.path);
            items.push({
                name: folder.name,
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
        } catch (err) {
            // Folder not accessible, skip
        }
    }

    // Add drives
    const drives = await getDrives();
    for (const drive of drives) {
        // Simple consistent object for all platforms
        items.push({
            name: drive.name,
            path: drive.path,
            isDirectory: true,
            isFile: false,
            isDrive: true,
            size: drive.total || 0,
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
    // Handle special "This PC" path for Windows
    if (dirPath === 'thispc://') {
        // This will be handled by main.cjs, but just in case
        return { success: false, error: 'Use getThisPCView for This PC path' };
    }

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

/**
 * specific Windows hidden check using attrib
 */
async function getWindowsHiddenAttribute(filePath) {
    try {
        const { stdout } = await execAsync(`attrib "${filePath}"`);
        // Output is like: "A  H       C:\Path\To\File"
        // Check for 'H' in the first section
        return stdout.slice(0, 12).includes('H');
    } catch {
        return false;
    }
}

async function setWindowsHiddenAttribute(filePath, hide) {
    try {
        const command = `attrib ${hide ? '+h' : '-h'} "${filePath}"`;
        await execAsync(command);
        return true;
    } catch (error) {
        console.error('Error setting hidden attribute:', error);
        return false;
    }
}

/**
 * Recursive folder statistics
 */
async function calculateFolderStats(dirPath) {
    let size = 0;
    let files = 0;
    let folders = 0;

    async function traverse(currentPath) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    folders++;
                    await traverse(fullPath);
                } else if (entry.isFile()) {
                    files++;
                    try {
                        const stats = await fs.stat(fullPath);
                        size += stats.size;
                    } catch { }
                }
            }
        } catch {
            // Ignore inaccessible folders
        }
    }

    await traverse(dirPath);
    return { size, files, folders };
}

/**
 * Get unified content info for Properties dialog
 */
async function getContentInfo(itemPath) {
    try {
        const stats = await fs.stat(itemPath);
        const name = path.basename(itemPath);
        const isWindows = os.platform() === 'win32';

        // Determine hidden status
        let isHidden = false;
        if (isWindows) {
            isHidden = await getWindowsHiddenAttribute(itemPath);
        } else {
            isHidden = name.startsWith('.');
        }

        const baseInfo = {
            name,
            path: itemPath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            isHidden,
            readOnly: false
        };

        if (stats.isDirectory()) {
            return {
                ...baseInfo,
                type: 'folder',
                isDirectory: true
            };
        } else {
            return {
                ...baseInfo,
                type: 'file',
                isFile: true,
                extension: path.extname(itemPath).toLowerCase()
            };
        }
    } catch (error) {
        // Might be a drive
        const drives = await getDrives();
        const drive = drives.find(d => d.path.toLowerCase() === itemPath.toLowerCase() || d.path.replace(/\\$/, '').toLowerCase() === itemPath.toLowerCase());

        if (drive) {
            return {
                ...drive,
                type: 'drive',
                isDrive: true,
                isDirectory: true
            };
        }

        return { error: error.message };
    }
}

async function setHiddenAttribute(itemPath, hide) {
    const isWindows = os.platform() === 'win32';
    if (isWindows) {
        return await setWindowsHiddenAttribute(itemPath, hide);
    } else {
        // Unix style: rename with . prefix
        const dir = path.dirname(itemPath);
        const name = path.basename(itemPath);
        let newName = name;

        if (hide && !name.startsWith('.')) {
            newName = '.' + name;
        } else if (!hide && name.startsWith('.')) {
            newName = name.substring(1);
        }

        if (newName !== name) {
            try {
                await fs.rename(itemPath, path.join(dir, newName));
                return true;
            } catch {
                return false;
            }
        }
        return true;
    }
}

module.exports = {
    getSpecialFolders,
    getDrives,
    readDirectory,
    getFileInfo,
    getThisPCView,
    calculateFolderStats,
    getContentInfo,
    setHiddenAttribute
};
