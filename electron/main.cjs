const { app, BrowserWindow, ipcMain, shell, Menu, clipboard, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { exec } = require('child_process');
const os = require('os');
const crypto = require('crypto');
const fileSystem = require('./fileSystem.cjs');

let mainWindow;

// Thumbnail cache directory
const THUMBNAIL_CACHE_DIR = path.join(app.getPath('userData'), '.thumbnails');

// Ensure thumbnail cache directory exists
async function ensureThumbnailCacheDir() {
    try {
        await fs.mkdir(THUMBNAIL_CACHE_DIR, { recursive: true });
    } catch (err) {
        // Directory already exists
    }
}

// Generate hash for file path to use as cache key
function getFileHash(filePath, mtime) {
    const data = `${filePath}-${mtime}`;
    return crypto.createHash('md5').update(data).digest('hex');
}

// Get cached thumbnail path
function getCachePath(filePath, mtime) {
    const hash = getFileHash(filePath, mtime);
    return path.join(THUMBNAIL_CACHE_DIR, `${hash}.jpg`);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        transparent: true,
        vibrancy: 'under-window',
        visualEffectState: 'active',
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false,
        },
        icon: path.join(__dirname, '../build/icon.png')
    });

    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        mainWindow.loadURL('http://localhost:5174');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Window control handlers
ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.on('window-close', () => {
    mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized();
});

// File system handlers
ipcMain.handle('fs:get-home-path', () => {
    return app.getPath('home');
});

ipcMain.handle('fs:get-special-folders', () => {
    return fileSystem.getSpecialFolders(app);
});

ipcMain.handle('fs:get-drives', async () => {
    return await fileSystem.getDrives();
});

ipcMain.handle('fs:read-directory', async (event, dirPath) => {
    return await fileSystem.readDirectory(dirPath);
});

ipcMain.handle('fs:open-file', async (event, filePath) => {
    return await shell.openPath(filePath);
});

ipcMain.handle('fs:get-file-info', async (event, filePath) => {
    return await fileSystem.getFileInfo(filePath);
});

// Thumbnail generation with caching
ipcMain.handle('fs:get-thumbnail', async (event, filePath, size = 128) => {
    try {
        await ensureThumbnailCacheDir();

        const stats = await fs.stat(filePath);
        const mtime = stats.mtimeMs.toString();
        const ext = path.extname(filePath).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico'];

        if (!imageExts.includes(ext)) {
            return { success: false };
        }

        // Check if cached thumbnail exists
        const cachePath = getCachePath(filePath, mtime);
        try {
            const cachedData = await fs.readFile(cachePath);
            return {
                success: true,
                data: `data:image/jpeg;base64,${cachedData.toString('base64')}`,
                type: 'image',
                cached: true
            };
        } catch {
            // Cache miss, generate new thumbnail
        }

        // Read original image
        const data = await fs.readFile(filePath);
        const base64 = data.toString('base64');
        const mimeType = ext === '.png' ? 'image/png' :
            ext === '.gif' ? 'image/gif' :
                ext === '.webp' ? 'image/webp' :
                    ext === '.bmp' ? 'image/bmp' :
                        ext === '.ico' ? 'image/x-icon' : 'image/jpeg';

        // Try to cache the thumbnail (for small files, just use original)
        if (stats.size < 500000) { // Less than 500KB, use original
            try {
                await fs.writeFile(cachePath, data);
            } catch {
                // Cache write failed, continue anyway
            }
        }

        return {
            success: true,
            data: `data:${mimeType};base64,${base64}`,
            type: 'image',
            cached: false
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get image metadata (EXIF)
ipcMain.handle('fs:get-image-metadata', async (event, filePath) => {
    try {
        const stats = await fs.stat(filePath);
        const ext = path.extname(filePath).toLowerCase();

        // Basic metadata
        const metadata = {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            extension: ext,
        };

        // Try to get image dimensions using nativeImage
        try {
            const image = nativeImage.createFromPath(filePath);
            if (!image.isEmpty()) {
                const size = image.getSize();
                metadata.width = size.width;
                metadata.height = size.height;
                metadata.aspectRatio = (size.width / size.height).toFixed(2);
                metadata.megapixels = ((size.width * size.height) / 1000000).toFixed(2);
            }
        } catch {
            // Could not get image dimensions
        }

        return { success: true, metadata };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get video metadata
ipcMain.handle('fs:get-video-metadata', async (event, filePath) => {
    return new Promise((resolve) => {
        const stats = fsSync.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();

        const metadata = {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            extension: ext,
        };

        // Try ffprobe for video metadata
        exec(`ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`, (error, stdout) => {
            if (!error && stdout) {
                try {
                    const info = JSON.parse(stdout);
                    if (info.format) {
                        metadata.duration = parseFloat(info.format.duration);
                        metadata.bitrate = parseInt(info.format.bit_rate);
                        metadata.formatName = info.format.format_long_name;
                    }
                    if (info.streams) {
                        const videoStream = info.streams.find(s => s.codec_type === 'video');
                        if (videoStream) {
                            metadata.width = videoStream.width;
                            metadata.height = videoStream.height;
                            metadata.codec = videoStream.codec_name;
                            metadata.fps = eval(videoStream.r_frame_rate);
                        }
                        const audioStream = info.streams.find(s => s.codec_type === 'audio');
                        if (audioStream) {
                            metadata.audioCodec = audioStream.codec_name;
                            metadata.channels = audioStream.channels;
                            metadata.sampleRate = parseInt(audioStream.sample_rate);
                        }
                    }
                } catch {
                    // JSON parse failed
                }
            }
            resolve({ success: true, metadata });
        });
    });
});

// File operations
ipcMain.handle('fs:delete-file', async (event, filePath) => {
    try {
        // Move to trash (safe delete)
        await shell.trashItem(filePath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('fs:confirm-delete', async (event, count, isFolder) => {
    const response = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancel', 'Delete'],
        defaultId: 1,
        title: 'Confirm Delete',
        message: `Are you sure you want to delete ${count > 1 ? `these ${count} items` : `this ${isFolder ? 'folder' : 'file'}`}?`,
        detail: 'This action will move the item(s) to the Trash.',
        icon: path.join(__dirname, '../build/icon.png'),
    });
    return response.response === 1;
});

ipcMain.handle('fs:open-with', async (event, filePath) => {
    const platform = os.platform();
    try {
        if (platform === 'win32') {
            // Trigger Windows "Open With" dialog
            exec(`rundll32.exe shell32.dll,OpenAs_RunDLL "${filePath}"`);
        } else if (platform === 'darwin') {
            // macOS: Reveal in Finder (user can right-click > Open With) or force open
            // There isn't a simple "Show Open With Dialog" command.
            // Best proxy: Open -R to reveal, or just open.
            // Another option: "open -a Finder <path>"
            shell.showItemInFolder(filePath);
        } else {
            // Linux: show in folder
            shell.showItemInFolder(filePath);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('fs:rename-file', async (event, oldPath, newName) => {
    try {
        const dir = path.dirname(oldPath);
        const newPath = path.join(dir, newName);
        await fs.rename(oldPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('fs:show-in-folder', async (event, filePath) => {
    shell.showItemInFolder(filePath);
    return { success: true };
});

// Clipboard operations
let clipboardItems = [];
let clipboardAction = null; // 'cut' or 'copy'

ipcMain.handle('clipboard:copy', async (event, paths) => {
    clipboardItems = Array.isArray(paths) ? paths : [paths];
    clipboardAction = 'copy';
    return { success: true, count: clipboardItems.length };
});

ipcMain.handle('clipboard:cut', async (event, paths) => {
    clipboardItems = Array.isArray(paths) ? paths : [paths];
    clipboardAction = 'cut';
    return { success: true, count: clipboardItems.length };
});

ipcMain.handle('clipboard:paste', async (event, destinationPath) => {
    if (!clipboardItems.length || !clipboardAction) {
        return { success: false, error: 'Clipboard is empty' };
    }

    const results = [];
    for (const sourcePath of clipboardItems) {
        try {
            const fileName = path.basename(sourcePath);
            let destPath = path.join(destinationPath, fileName);

            // Handle name conflicts
            let counter = 1;
            while (fsSync.existsSync(destPath)) {
                const ext = path.extname(fileName);
                const base = path.basename(fileName, ext);
                destPath = path.join(destinationPath, `${base} (${counter})${ext}`);
                counter++;
            }

            const stats = await fs.stat(sourcePath);

            if (clipboardAction === 'copy') {
                if (stats.isDirectory()) {
                    await copyDirectory(sourcePath, destPath);
                } else {
                    await fs.copyFile(sourcePath, destPath);
                }
            } else if (clipboardAction === 'cut') {
                await fs.rename(sourcePath, destPath);
            }

            results.push({ source: sourcePath, dest: destPath, success: true });
        } catch (error) {
            results.push({ source: sourcePath, success: false, error: error.message });
        }
    }

    // Clear clipboard after paste (Windows-style: one-time paste)
    clipboardItems = [];
    clipboardAction = null;

    return { success: true, results };
});

ipcMain.handle('clipboard:get-status', async () => {
    return {
        items: clipboardItems,
        action: clipboardAction,
        count: clipboardItems.length
    };
});

// Helper function to copy directory recursively
async function copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

// Context menu
ipcMain.handle('show-context-menu', async (event, menuType, itemPath) => {
    return new Promise((resolve) => {
        const template = [];

        if (menuType === 'file') {
            template.push(
                { label: 'Open', click: () => { shell.openPath(itemPath); resolve('open'); } },
                // Open With removed per user request
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => resolve('cut') },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => resolve('copy') },
                { type: 'separator' },
                { label: 'Rename', accelerator: 'F2', click: () => resolve('rename') },
                { label: 'Delete', accelerator: 'Delete', click: () => resolve('delete') },
                { type: 'separator' },
                { label: 'Compress to ZIP', click: () => resolve('zip') },
                { type: 'separator' },
                { label: 'Properties', accelerator: 'Alt+Enter', click: () => resolve('properties') }
            );
        } else if (menuType === 'folder') {
            template.push(
                { label: 'Open', click: () => resolve('open') },
                { label: 'Open in new window', click: () => resolve('open-new') },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => resolve('cut') },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => resolve('copy') },
                { type: 'separator' },
                { label: 'Rename', accelerator: 'F2', click: () => resolve('rename') },
                { label: 'Delete', accelerator: 'Delete', click: () => resolve('delete') },
                { type: 'separator' },
                { label: 'Compress to ZIP', click: () => resolve('zip') },
                { type: 'separator' },
                { label: 'Properties', accelerator: 'Alt+Enter', click: () => resolve('properties') }
            );
        } else if (menuType === 'drive') {
            template.push(
                { label: 'Open', click: () => resolve('open') },
                { type: 'separator' },
                { label: 'Properties', click: () => resolve('properties') }
            );
        } else if (menuType === 'background') {
            template.push(
                { label: 'New Folder', click: () => resolve('new-folder') },
                { label: 'New File', click: () => resolve('new-file') },
                { type: 'separator' },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    enabled: clipboardItems.length > 0,
                    click: () => resolve('paste')
                },
                { type: 'separator' },
                { label: 'Refresh', accelerator: 'F5', click: () => resolve('refresh') },
                { type: 'separator' },
                { label: 'Properties', click: () => resolve('properties') }
            );
        }

        const menu = Menu.buildFromTemplate(template);
        menu.popup({ window: mainWindow });
        menu.on('menu-will-close', () => {
            setTimeout(() => resolve(null), 100);
        });
    });
});

// Create new folder
ipcMain.handle('fs:create-folder', async (event, parentPath, folderName) => {
    try {
        const newPath = path.join(parentPath, folderName);
        await fs.mkdir(newPath);
        return { success: true, path: newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create new file
ipcMain.handle('fs:create-file', async (event, parentPath, fileName) => {
    try {
        const newPath = path.join(parentPath, fileName);
        await fs.writeFile(newPath, '');
        return { success: true, path: newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read file content for preview
ipcMain.handle('fs:read-file-preview', async (event, filePath, maxBytes = 50000) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const stats = await fs.stat(filePath);

        // Image files
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg'];
        if (imageExts.includes(ext)) {
            const data = await fs.readFile(filePath);
            const base64 = data.toString('base64');
            const mimeType = ext === '.svg' ? 'image/svg+xml' :
                ext === '.png' ? 'image/png' :
                    ext === '.gif' ? 'image/gif' :
                        ext === '.webp' ? 'image/webp' :
                            ext === '.bmp' ? 'image/bmp' :
                                ext === '.ico' ? 'image/x-icon' : 'image/jpeg';
            return { success: true, type: 'image', data: `data:${mimeType};base64,${base64}` };
        }

        // Video files
        const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];
        if (videoExts.includes(ext)) {
            return { success: true, type: 'video', path: filePath };
        }

        // Audio files
        const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a'];
        if (audioExts.includes(ext)) {
            return { success: true, type: 'audio', path: filePath };
        }

        // PDF files
        if (ext === '.pdf') {
            return { success: true, type: 'pdf', path: filePath };
        }

        // Text-based files
        const textExts = ['.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html',
            '.xml', '.yaml', '.yml', '.py', '.java', '.c', '.cpp', '.h', '.cs',
            '.go', '.rs', '.rb', '.php', '.sh', '.bash', '.sql', '.log', '.ini',
            '.cfg', '.conf', '.env'];
        if (textExts.includes(ext) || stats.size < maxBytes) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                return {
                    success: true,
                    type: 'text',
                    content: content.slice(0, maxBytes),
                    truncated: content.length > maxBytes
                };
            } catch {
                return { success: true, type: 'binary' };
            }
        }

        return { success: true, type: 'unknown' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Zip file/folder
ipcMain.handle('fs:zip-file', async (event, filePath) => {
    return new Promise((resolve) => {
        const platform = os.platform();
        const fileName = path.basename(filePath);
        const dir = path.dirname(filePath);
        const zipName = fileName + '.zip';
        const zipPath = path.join(dir, zipName);

        let command;
        if (platform === 'win32') {
            command = `powershell -command "Compress-Archive -Path '${filePath}' -DestinationPath '${zipPath}'"`;
        } else if (platform === 'darwin') {
            command = `cd "${dir}" && zip -r "${zipName}" "${fileName}"`;
        } else {
            command = `cd "${dir}" && zip -r "${zipName}" "${fileName}"`;
        }

        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: error.message || stderr });
            } else {
                resolve({ success: true, zipPath });
            }
        });
    });
});

// Open with system file manager archive tool
ipcMain.handle('fs:open-archive-manager', async (event, filePath) => {
    const platform = os.platform();

    if (platform === 'win32') {
        shell.showItemInFolder(filePath);
    } else if (platform === 'darwin') {
        shell.openPath(filePath);
    } else {
        const archiveManagers = ['file-roller', 'ark', 'engrampa', 'xarchiver'];
        for (const manager of archiveManagers) {
            try {
                exec(`which ${manager}`, (error) => {
                    if (!error) {
                        exec(`${manager} "${filePath}"`);
                        return;
                    }
                });
            } catch {
                continue;
            }
        }
        shell.openPath(filePath);
    }
    return { success: true };
});

app.whenReady().then(() => {
    ensureThumbnailCacheDir();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
