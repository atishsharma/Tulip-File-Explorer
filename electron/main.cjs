const { app, BrowserWindow, ipcMain, shell, Menu, clipboard, nativeImage, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { execFile, spawn } = require('child_process');
const { pathToFileURL, fileURLToPath } = require('url');
const os = require('os');
const crypto = require('crypto');
const fileSystem = require('./fileSystem.cjs');
const RcloneManager = require('./rcloneManager.cjs');
const {
    assertPath,
    validateName,
    isSubPath,
    exists,
    uniquePath,
    parseFrameRate,
    isSafeExternalUrl,
    withTimeout,
} = require('./utils.cjs');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5174';
// TULIP_LOAD_DIST=1 runs the built renderer from an unpackaged checkout (used for smoke tests)
const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.TULIP_LOAD_DIST !== '1');

// Custom scheme used by the renderer to load local media without disabling web security
const FILE_SCHEME = 'tulip-file';
protocol.registerSchemesAsPrivileged([
    { scheme: FILE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let mainWindow = null;
const rcloneManager = new RcloneManager(app.getPath('userData'));

function send(channel, payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
    }
}

// ---------------------------------------------------------------------------
// Drive monitoring: one poller in the main process pushes changes to the renderer
// ---------------------------------------------------------------------------

let drivePollTimer = null;
let driveWatchers = [];
let lastDriveSnapshot = '';
let drivePollRunning = false;
let driveDebounce = null;

function enrichDrives(drives, mounted) {
    const mountedMap = new Map(mounted.map((m) => [m.path.replace(/\\$/, '').toUpperCase(), m.name]));
    return drives.map((drive) => {
        const remoteName = mountedMap.get(drive.path.replace(/\\$/, '').toUpperCase());
        // Show the remote name instead of "Label (Z:\)" for cloud mounts
        return remoteName ? { ...drive, name: remoteName, isCloud: true } : drive;
    });
}

async function pollDrives(force = false) {
    if (drivePollRunning) return;
    drivePollRunning = true;
    try {
        const [drives, rcloneMounts] = await Promise.all([fileSystem.getDrives(), rcloneManager.getMounted()]);
        const payload = { drives: enrichDrives(drives, rcloneMounts), rcloneMounts };
        const snapshot = JSON.stringify(payload);
        if (force || snapshot !== lastDriveSnapshot) {
            lastDriveSnapshot = snapshot;
            send('drives-updated', payload);
        }
    } catch (error) {
        console.error('Drive monitoring error:', error);
    } finally {
        drivePollRunning = false;
    }
}

function schedulePoll() {
    clearTimeout(driveDebounce);
    driveDebounce = setTimeout(() => pollDrives(), 300);
}

function startDriveMonitoring() {
    if (drivePollTimer) return;

    if (os.platform() === 'linux') {
        // Non-recursive watches on mount roots; recursive watching of /mnt can crawl whole disks (WSL)
        const user = os.userInfo().username;
        for (const watchPath of ['/media', `/media/${user}`, `/run/media/${user}`, '/mnt']) {
            if (!fsSync.existsSync(watchPath)) continue;
            try {
                driveWatchers.push(fsSync.watch(watchPath, schedulePoll));
            } catch (e) {
                console.log(`Could not watch ${watchPath}:`, e.message);
            }
        }
    } else if (os.platform() === 'darwin' && fsSync.existsSync('/Volumes')) {
        try {
            driveWatchers.push(fsSync.watch('/Volumes', schedulePoll));
        } catch { /* polling still covers it */ }
    }

    drivePollTimer = setInterval(() => pollDrives(), 5000);
}

function stopDriveMonitoring() {
    clearInterval(drivePollTimer);
    drivePollTimer = null;
    clearTimeout(driveDebounce);
    driveWatchers.forEach((w) => w.close());
    driveWatchers = [];
    lastDriveSnapshot = '';
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

const THUMBNAIL_CACHE_DIR = path.join(app.getPath('userData'), '.thumbnails');
const THUMBNAIL_CACHE_MAX_FILES = 5000;
const THUMBNAIL_MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg', '.tiff', '.tif'];
const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv', '.m4v'];

async function ensureThumbnailCacheDir() {
    await fs.mkdir(THUMBNAIL_CACHE_DIR, { recursive: true });
}

// Delete the oldest cache entries once the cache grows past the limit
async function pruneThumbnailCache() {
    try {
        const names = await fs.readdir(THUMBNAIL_CACHE_DIR);
        if (names.length <= THUMBNAIL_CACHE_MAX_FILES) return;
        const entries = await Promise.all(names.map(async (name) => {
            const full = path.join(THUMBNAIL_CACHE_DIR, name);
            try {
                return { full, time: (await fs.stat(full)).mtimeMs };
            } catch {
                return null;
            }
        }));
        const sorted = entries.filter(Boolean).sort((a, b) => a.time - b.time);
        const excess = sorted.slice(0, sorted.length - Math.floor(THUMBNAIL_CACHE_MAX_FILES * 0.8));
        await Promise.all(excess.map((e) => fs.unlink(e.full).catch(() => {})));
    } catch { /* cache dir missing */ }
}

// Serialize synchronous image decoding so bursts of thumbnails don't freeze the UI
let thumbnailQueue = Promise.resolve();
function enqueueThumbnail(task) {
    const result = thumbnailQueue.then(() => new Promise((resolve) => setImmediate(resolve))).then(task);
    thumbnailQueue = result.catch(() => {});
    return result;
}

function runFfmpegFrame(filePath, size, outPath) {
    return new Promise((resolve, reject) => {
        execFile('ffmpeg', [
            '-y', '-v', 'error', '-ss', '1', '-i', filePath,
            '-frames:v', '1', '-vf', `scale=-2:${size}`, outPath,
        ], { timeout: 15000, windowsHide: true }, (error) => (error ? reject(error) : resolve()));
    });
}

async function generateThumbnail(filePath, ext, size, cachePath) {
    // Windows/macOS: OS thumbnailer handles images and videos off the main thread
    if (process.platform === 'win32' || process.platform === 'darwin') {
        const image = await nativeImage.createThumbnailFromPath(filePath, { width: size, height: size });
        if (image.isEmpty()) throw new Error('Failed to load image');
        return image.toJPEG(80);
    }

    if (VIDEO_EXTS.includes(ext)) {
        await runFfmpegFrame(filePath, size, cachePath);
        return fs.readFile(cachePath);
    }

    return enqueueThumbnail(() => {
        const image = nativeImage.createFromPath(filePath);
        if (image.isEmpty()) throw new Error('Failed to load image');
        const { width, height } = image.getSize();
        const resized = height > size || width > size
            ? image.resize(width >= height ? { width: size, quality: 'good' } : { height: size, quality: 'good' })
            : image;
        return resized.toJPEG(80);
    });
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

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
            sandbox: true,
            webSecurity: true,
        },
        icon: path.join(__dirname, '../build/icons/512x512.png'),
    });

    if (isDev) {
        mainWindow.loadURL(DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        stopDriveMonitoring();
        mainWindow = null;
    });

    mainWindow.webContents.on('did-finish-load', () => {
        startDriveMonitoring();
        pollDrives(true);
    });
}

// Never let the renderer navigate away or open new windows
app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
        const allowed = isDev ? url.startsWith(DEV_SERVER_URL) : url.startsWith('file://');
        if (!allowed) event.preventDefault();
    });
    contents.setWindowOpenHandler(({ url }) => {
        if (isSafeExternalUrl(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
});

// Wrap an IPC handler so thrown validation errors become { success: false, error }
function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized());

ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('get-platform', () => os.platform());

// ---------------------------------------------------------------------------
// File system
// ---------------------------------------------------------------------------

ipcMain.handle('fs:get-special-folders', () => fileSystem.getSpecialFolders(app));
ipcMain.handle('fs:get-initial-path', () => 'thispc://');

ipcMain.handle('fs:get-drives', async () => {
    const [drives, mounted] = await Promise.all([fileSystem.getDrives(), rcloneManager.getMounted()]);
    return enrichDrives(drives, mounted);
});

handle('fs:read-directory', async (dirPath) => fileSystem.readDirectory(assertPath(dirPath)));

ipcMain.handle('fs:get-thispc-view', async () => {
    const result = await fileSystem.getThisPCView(app);
    if (!result.success) return result;
    const mounted = await rcloneManager.getMounted();
    result.items = result.items.filter((i) => !i.isDrive).concat(
        enrichDrives(result.items.filter((i) => i.isDrive), mounted),
    );
    return result;
});

handle('fs:open-file', async (filePath) => {
    const error = await shell.openPath(assertPath(filePath));
    return error ? { success: false, error } : { success: true };
});

handle('fs:get-content-info', async (filePath) => fileSystem.getContentInfo(assertPath(filePath)));

const folderStatJobs = new Map(); // path -> { cancelled }
handle('fs:calculate-folder-stats', async (dirPath) => {
    assertPath(dirPath);
    const previous = folderStatJobs.get(dirPath);
    if (previous) previous.cancelled = true;
    const job = { cancelled: false };
    folderStatJobs.set(dirPath, job);
    try {
        return await fileSystem.calculateFolderStats(dirPath, () => job.cancelled);
    } finally {
        if (folderStatJobs.get(dirPath) === job) folderStatJobs.delete(dirPath);
    }
});
ipcMain.handle('fs:cancel-folder-stats', (_e, dirPath) => {
    const job = folderStatJobs.get(dirPath);
    if (job) job.cancelled = true;
    return { success: true };
});

handle('fs:set-hidden-attribute', async (filePath, hide) => fileSystem.setHiddenAttribute(assertPath(filePath), !!hide));

handle('fs:get-thumbnail', async (filePath, requestedSize = 256) => {
    assertPath(filePath);
    const size = Math.max(16, Math.min(512, Math.round(Number(requestedSize) || 256)));
    const ext = path.extname(filePath).toLowerCase();
    if (!IMAGE_EXTS.includes(ext) && !VIDEO_EXTS.includes(ext)) {
        return { success: false, error: 'Unsupported file type' };
    }

    const stats = await fs.stat(filePath);
    if (IMAGE_EXTS.includes(ext) && stats.size > THUMBNAIL_MAX_SOURCE_BYTES) {
        return { success: false, error: 'Image too large for thumbnail' };
    }

    const cacheKey = `${filePath}|${stats.mtimeMs}|${stats.size}|${size}`;
    const cachePath = path.join(THUMBNAIL_CACHE_DIR, `${crypto.createHash('sha1').update(cacheKey).digest('hex')}.jpg`);

    try {
        const cached = await fs.readFile(cachePath);
        return { success: true, data: `data:image/jpeg;base64,${cached.toString('base64')}`, cached: true };
    } catch { /* cache miss */ }

    await ensureThumbnailCacheDir();
    const buffer = await generateThumbnail(filePath, ext, size, cachePath);
    await fs.writeFile(cachePath, buffer).catch((e) => console.error('Failed to write thumbnail cache:', e.message));
    return { success: true, data: `data:image/jpeg;base64,${buffer.toString('base64')}`, cached: false };
});

handle('fs:get-image-metadata', async (filePath) => {
    assertPath(filePath);
    const stats = await fs.stat(filePath);
    const metadata = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: path.extname(filePath).toLowerCase(),
    };

    if (stats.size <= THUMBNAIL_MAX_SOURCE_BYTES) {
        const image = await enqueueThumbnail(() => nativeImage.createFromPath(filePath));
        if (!image.isEmpty()) {
            const { width, height } = image.getSize();
            metadata.width = width;
            metadata.height = height;
            metadata.aspectRatio = height ? (width / height).toFixed(2) : null;
            metadata.megapixels = ((width * height) / 1000000).toFixed(2);
        }
    }
    return { success: true, metadata };
});

handle('fs:get-video-metadata', async (filePath) => {
    assertPath(filePath);
    const stats = await fs.stat(filePath);
    const metadata = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: path.extname(filePath).toLowerCase(),
    };

    const stdout = await new Promise((resolve) => {
        execFile('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
            { timeout: 10000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
            (error, out) => resolve(error ? null : out));
    });

    if (stdout) {
        try {
            const info = JSON.parse(stdout);
            if (info.format) {
                metadata.duration = parseFloat(info.format.duration) || undefined;
                metadata.bitrate = parseInt(info.format.bit_rate, 10) || undefined;
                metadata.formatName = info.format.format_long_name;
            }
            const videoStream = info.streams?.find((s) => s.codec_type === 'video');
            if (videoStream) {
                metadata.width = videoStream.width;
                metadata.height = videoStream.height;
                metadata.codec = videoStream.codec_name;
                metadata.fps = parseFrameRate(videoStream.r_frame_rate);
            }
            const audioStream = info.streams?.find((s) => s.codec_type === 'audio');
            if (audioStream) {
                metadata.audioCodec = audioStream.codec_name;
                metadata.channels = audioStream.channels;
                metadata.sampleRate = parseInt(audioStream.sample_rate, 10) || undefined;
            }
        } catch { /* malformed ffprobe output */ }
    } else {
        metadata.ffprobeMissing = true;
    }
    return { success: true, metadata };
});

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

handle('fs:delete-file', async (filePath) => {
    await shell.trashItem(assertPath(filePath));
    return { success: true };
});

ipcMain.handle('fs:confirm-delete', async (_event, names, isFolder) => {
    const list = Array.isArray(names) ? names.map(String) : [];
    const count = list.length;
    const shown = list.slice(0, 10).map((n) => `• ${n}`).join('\n') + (count > 10 ? `\n…and ${count - 10} more` : '');
    const response = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancel', 'Move to Trash'],
        defaultId: 1,
        cancelId: 0,
        title: 'Confirm Delete',
        message: count > 1
            ? `Move these ${count} items to the Trash?`
            : `Move this ${isFolder ? 'folder' : 'file'} to the Trash?`,
        detail: shown,
        icon: path.join(__dirname, '../build/icon.png'),
    });
    return response.response === 1;
});

handle('fs:rename-file', async (oldPath, newName) => {
    assertPath(oldPath);
    const invalid = validateName(newName);
    if (invalid) return { success: false, error: invalid };

    const newPath = path.join(path.dirname(oldPath), newName);
    if (newPath === oldPath) return { success: true, newPath };

    // Allow case-only renames on case-insensitive file systems; otherwise never overwrite
    const caseOnly = newPath.toLowerCase() === oldPath.toLowerCase();
    if (!caseOnly && (await exists(newPath))) {
        return { success: false, error: `"${newName}" already exists in this folder` };
    }
    await fs.rename(oldPath, newPath);
    return { success: true, newPath };
});

handle('fs:show-in-folder', async (filePath) => {
    shell.showItemInFolder(assertPath(filePath));
    return { success: true };
});

handle('fs:create-folder', async (parentPath, folderName = 'New Folder') => {
    assertPath(parentPath);
    const invalid = validateName(folderName);
    if (invalid) return { success: false, error: invalid };
    const newPath = await uniquePath(parentPath, folderName);
    await fs.mkdir(newPath);
    return { success: true, path: newPath };
});

handle('fs:create-file', async (parentPath, fileName = 'New Text Document.txt') => {
    assertPath(parentPath);
    const invalid = validateName(fileName);
    if (invalid) return { success: false, error: invalid };
    const newPath = await uniquePath(parentPath, fileName);
    // "wx" fails instead of truncating if something appeared in the meantime
    await fs.writeFile(newPath, '', { flag: 'wx' });
    return { success: true, path: newPath };
});

const TEXT_EXTS = ['.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html',
    '.xml', '.yaml', '.yml', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.rb',
    '.php', '.sh', '.bash', '.sql', '.log', '.ini', '.cfg', '.conf', '.env', '.csv', '.toml'];

handle('fs:read-file-preview', async (filePath, requestedMax = 50000) => {
    assertPath(filePath);
    const maxBytes = Math.max(1024, Math.min(1024 * 1024, Number(requestedMax) || 50000));
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);

    // Media is streamed by the renderer through the tulip-file:// protocol, never base64 over IPC
    if (IMAGE_EXTS.includes(ext)) return { success: true, type: 'image', path: filePath };
    if (VIDEO_EXTS.includes(ext)) return { success: true, type: 'video', path: filePath };
    if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus'].includes(ext)) {
        return { success: true, type: 'audio', path: filePath };
    }
    if (ext === '.pdf') return { success: true, type: 'pdf', path: filePath };

    if (!TEXT_EXTS.includes(ext) && stats.size > maxBytes) {
        return { success: true, type: 'unknown' };
    }

    // Read only the first maxBytes, regardless of file size
    const handleFile = await fs.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(Math.min(maxBytes, stats.size));
        const { bytesRead } = await handleFile.read(buffer, 0, buffer.length, 0);
        const chunk = buffer.subarray(0, bytesRead);
        if (chunk.subarray(0, 8000).includes(0)) {
            return { success: true, type: 'binary' };
        }
        return {
            success: true,
            type: 'text',
            content: chunk.toString('utf8'),
            truncated: stats.size > bytesRead,
        };
    } finally {
        await handleFile.close();
    }
});

handle('fs:zip-file', async (filePath) => {
    assertPath(filePath);
    const fileName = path.basename(filePath);
    const dir = path.dirname(filePath);
    const zipPath = await uniquePath(dir, `${fileName}.zip`);

    await new Promise((resolve, reject) => {
        const done = (error, _stdout, stderr) => {
            if (!error) return resolve();
            if (error.code === 'ENOENT') return reject(new Error('The "zip" command is not installed'));
            reject(new Error((stderr && stderr.trim()) || error.message));
        };
        if (process.platform === 'win32') {
            // Paths passed via environment so they are never parsed as PowerShell code
            execFile('powershell.exe', [
                '-NoProfile', '-NonInteractive', '-Command',
                'Compress-Archive -LiteralPath $env:TULIP_SRC -DestinationPath $env:TULIP_DST',
            ], { env: { ...process.env, TULIP_SRC: filePath, TULIP_DST: zipPath }, windowsHide: true }, done);
        } else {
            // "./" prefix keeps names starting with "-" from being read as options
            execFile('zip', ['-r', '-q', '-y', path.basename(zipPath), `./${fileName}`], { cwd: dir }, done);
        }
    });
    return { success: true, zipPath };
});

// ---------------------------------------------------------------------------
// Clipboard (internal buffer, mirrored to the OS clipboard where possible)
// ---------------------------------------------------------------------------

let clipboardItems = [];
let clipboardAction = null; // 'cut' | 'copy'
let osClipboardStamp = null;

function readOsClipboardFiles() {
    try {
        let urls = [];
        if (process.platform === 'linux') {
            const gnome = clipboard.readBuffer('x-special/gnome-copied-files').toString('utf8');
            if (gnome) {
                const [action, ...rest] = gnome.split('\n').map((l) => l.trim()).filter(Boolean);
                return { action: action === 'cut' ? 'cut' : 'copy', paths: rest.map((u) => fileURLToPath(u)), stamp: gnome };
            }
            urls = clipboard.readBuffer('text/uri-list').toString('utf8').split('\n');
        } else if (process.platform === 'darwin') {
            urls = [clipboard.read('public.file-url')];
        } else {
            const raw = clipboard.readBuffer('FileNameW').toString('ucs2').replace(/\0+$/, '');
            return raw ? { action: 'copy', paths: [raw], stamp: raw } : null;
        }
        const paths = urls.map((u) => u.trim()).filter((u) => u.startsWith('file://')).map((u) => fileURLToPath(u));
        return paths.length ? { action: 'copy', paths, stamp: paths.join('\n') } : null;
    } catch {
        return null;
    }
}

function writeOsClipboardFiles(paths, action) {
    try {
        if (process.platform === 'linux') {
            const payload = `${action}\n${paths.map((p) => pathToFileURL(p).href).join('\n')}`;
            clipboard.writeBuffer('x-special/gnome-copied-files', Buffer.from(payload, 'utf8'));
            osClipboardStamp = payload;
        } else {
            clipboard.writeText(paths.join(os.EOL));
            osClipboardStamp = null;
        }
    } catch { /* clipboard unavailable */ }
}

function clipboardStatus() {
    return { items: clipboardItems, action: clipboardAction, count: clipboardItems.length };
}

function setClipboard(paths, action) {
    const list = (Array.isArray(paths) ? paths : [paths]).map((p) => assertPath(p));
    clipboardItems = list;
    clipboardAction = action;
    writeOsClipboardFiles(list, action);
    send('clipboard-changed', clipboardStatus());
    return { success: true, count: list.length };
}

handle('clipboard:copy', async (paths) => setClipboard(paths, 'copy'));
handle('clipboard:cut', async (paths) => setClipboard(paths, 'cut'));
ipcMain.handle('clipboard:get-status', () => clipboardStatus());

async function moveItem(sourcePath, destPath) {
    try {
        await fs.rename(sourcePath, destPath);
    } catch (error) {
        if (error.code !== 'EXDEV') throw error;
        // Different device: copy then remove the original
        await fs.cp(sourcePath, destPath, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true, preserveTimestamps: true });
        await fs.rm(sourcePath, { recursive: true, force: true });
    }
}

handle('clipboard:paste', async (destinationPath) => {
    if (destinationPath === 'thispc://') return { success: false, error: 'Cannot paste here' };
    assertPath(destinationPath);

    // Prefer files copied in another app if they differ from our own buffer
    let sources = clipboardItems;
    let action = clipboardAction;
    const osFiles = readOsClipboardFiles();
    if (osFiles && osFiles.stamp !== osClipboardStamp && osFiles.paths.join('\n') !== clipboardItems.join('\n')) {
        sources = osFiles.paths;
        action = osFiles.action;
    }
    if (!sources.length || !action) return { success: false, error: 'Clipboard is empty' };

    const results = [];
    for (const sourcePath of sources) {
        try {
            const stats = await fs.lstat(sourcePath);
            if (stats.isDirectory() && isSubPath(sourcePath, destinationPath)) {
                throw new Error('Cannot paste a folder into itself');
            }
            // Cutting into the same folder is a no-op
            if (action === 'cut' && path.dirname(sourcePath) === path.resolve(destinationPath)) {
                results.push({ source: sourcePath, dest: sourcePath, success: true, skipped: true });
                continue;
            }

            const destPath = await uniquePath(destinationPath, path.basename(sourcePath));
            if (action === 'copy') {
                await fs.cp(sourcePath, destPath, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true, preserveTimestamps: true });
            } else {
                await moveItem(sourcePath, destPath);
            }
            results.push({ source: sourcePath, dest: destPath, success: true });
        } catch (error) {
            results.push({ source: sourcePath, success: false, error: error.message });
        }
    }

    // Copies can be pasted repeatedly; a cut is consumed by the first paste
    if (action === 'cut') {
        clipboardItems = [];
        clipboardAction = null;
        send('clipboard-changed', clipboardStatus());
    }

    const failed = results.filter((r) => !r.success);
    return {
        success: failed.length === 0,
        results,
        error: failed.length ? failed.map((f) => `${path.basename(f.source)}: ${f.error}`).join('\n') : undefined,
    };
});

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

ipcMain.handle('show-context-menu', async (_event, menuType, itemPath) => {
    return new Promise((resolve) => {
        let settled = false;
        const pick = (value) => () => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };

        const canPaste = clipboardItems.length > 0 || !!readOsClipboardFiles();
        const template = [];

        if (menuType === 'file' || menuType === 'folder') {
            template.push(
                { label: 'Open', click: pick('open') },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: pick('cut') },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: pick('copy') },
                { type: 'separator' },
                { label: 'Rename', accelerator: 'F2', click: pick('rename') },
                { label: 'Delete', accelerator: 'Delete', click: pick('delete') },
                { type: 'separator' },
                { label: 'Compress to ZIP', click: pick('zip') },
                { type: 'separator' },
                { label: 'Properties', accelerator: 'Alt+Enter', click: pick('properties') },
            );
        } else if (menuType === 'drive' || menuType === 'library') {
            template.push(
                { label: 'Open', click: pick('open') },
                { type: 'separator' },
                { label: 'Properties', click: pick('properties') },
            );
        } else if (menuType === 'cloud-drive') {
            template.push(
                { label: 'Open', click: pick('open') },
                { type: 'separator' },
                { label: 'Unmount', click: pick('unmount') },
                { type: 'separator' },
                { label: 'Properties', click: pick('properties') },
            );
        } else if (menuType === 'background' && itemPath !== 'thispc://') {
            template.push(
                { label: 'New Folder', click: pick('new-folder') },
                { label: 'New File', click: pick('new-file') },
                { type: 'separator' },
                { label: 'Paste', accelerator: 'CmdOrCtrl+V', enabled: canPaste, click: pick('paste') },
                { type: 'separator' },
                { label: 'Refresh', accelerator: 'F5', click: pick('refresh') },
                { type: 'separator' },
                { label: 'Properties', click: pick('properties') },
            );
        } else {
            template.push({ label: 'Refresh', accelerator: 'F5', click: pick('refresh') });
        }

        const menu = Menu.buildFromTemplate(template);
        // Click handlers can fire after menu-will-close on some platforms; wait briefly before giving up
        menu.on('menu-will-close', () => setTimeout(pick(null), 150));
        menu.popup({ window: mainWindow });
    });
});

// ---------------------------------------------------------------------------
// Rclone
// ---------------------------------------------------------------------------

ipcMain.handle('rclone:check-installed', () => rcloneManager.checkInstalled());

ipcMain.handle('rclone:list-remotes', async () => {
    try {
        return { success: true, remotes: await rcloneManager.listRemotes() };
    } catch (error) {
        return { success: false, error: error.message, notInstalled: error.code === 'RCLONE_NOT_INSTALLED' };
    }
});

handle('rclone:mount', async (remoteName, remoteType) => {
    const result = await rcloneManager.mountRemote(remoteName, remoteType);
    pollDrives(true);
    return result;
});

handle('rclone:unmount', async (remoteName) => {
    const result = await rcloneManager.unmountRemote(remoteName);
    pollDrives(true);
    return result;
});

ipcMain.handle('rclone:get-mounted', () => rcloneManager.getMounted());

// Try each terminal in turn until one launches
function launchInTerminal(candidates) {
    return new Promise((resolve) => {
        const tryNext = (i) => {
            if (i >= candidates.length) return resolve(false);
            const [cmd, args] = candidates[i];
            const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
            child.once('error', () => tryNext(i + 1));
            child.once('spawn', () => {
                child.unref();
                resolve(true);
            });
        };
        tryNext(0);
    });
}

handle('rclone:open-config', async () => {
    let launched;
    if (process.platform === 'win32') {
        launched = await launchInTerminal([['cmd.exe', ['/c', 'start', 'cmd', '/k', 'rclone config']]]);
    } else if (process.platform === 'darwin') {
        launched = await launchInTerminal([['osascript', ['-e', 'tell application "Terminal" to do script "rclone config"']]]);
    } else {
        launched = await launchInTerminal([
            ['x-terminal-emulator', ['-e', 'rclone', 'config']],
            ['gnome-terminal', ['--', 'rclone', 'config']],
            ['konsole', ['-e', 'rclone', 'config']],
            ['xfce4-terminal', ['-x', 'rclone', 'config']],
            ['xterm', ['-e', 'rclone', 'config']],
        ]);
    }
    return launched ? { success: true } : { success: false, error: 'No terminal emulator found. Run "rclone config" manually.' };
});

handle('open-external', async (url) => {
    if (!isSafeExternalUrl(url)) return { success: false, error: 'Blocked URL' };
    await shell.openExternal(url);
    return { success: true };
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
    // tulip-file://local/<encoded absolute path> -> local file (supports media streaming)
    protocol.handle(FILE_SCHEME, (request) => {
        try {
            const { pathname } = new URL(request.url);
            const filePath = decodeURIComponent(pathname.slice(1));
            assertPath(filePath);
            return net.fetch(pathToFileURL(filePath).href, { headers: request.headers });
        } catch {
            return new Response('Bad request', { status: 400 });
        }
    });

    await ensureThumbnailCacheDir().catch(() => {});
    pruneThumbnailCache();
    createWindow();
    rcloneManager.restoreMounts().then(() => pollDrives(true));
});

let quitting = false;
app.on('will-quit', (e) => {
    if (quitting) return;
    quitting = true;
    e.preventDefault();
    // Never let a hung unmount keep the app alive
    withTimeout(rcloneManager.unmountAll(), 8000)
        .catch((error) => console.error('Unmount on quit failed:', error.message))
        .finally(() => app.exit());
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
