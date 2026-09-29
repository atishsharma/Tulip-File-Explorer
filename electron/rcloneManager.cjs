const { execFile, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { withTimeout, isValidRemoteName } = require('./utils.cjs');
const { getDriveStats } = require('./fileSystem.cjs');

const MOUNT_READY_TIMEOUT = 15000;
const UNMOUNT_TIMEOUT = 5000;

function run(cmd, args, timeout = 10000) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                error.stderr = stderr;
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class RcloneManager {
    constructor(userDataPath) {
        this.mounts = new Map(); // remoteName -> { process, mountPath, type }
        this.baseMountDir = path.join(os.homedir(), 'TulipMounts');
        this.stateFile = path.join(userDataPath, 'rclone-mounts.json');
        this.isRcloneAvailable = false;
    }

    async checkInstalled() {
        try {
            await run('rclone', ['--version']);
            this.isRcloneAvailable = true;
        } catch {
            this.isRcloneAvailable = false;
        }
        return this.isRcloneAvailable;
    }

    async listRemotes() {
        if (!this.isRcloneAvailable && !(await this.checkInstalled())) {
            const error = new Error('rclone is not installed or not on PATH. Install it from https://rclone.org/install/');
            error.code = 'RCLONE_NOT_INSTALLED';
            throw error;
        }

        const stdout = await run('rclone', ['listremotes', '--long']);
        // Output is like "Drive:   drive\nDropbox: dropbox\n"
        return stdout.split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const idx = line.indexOf(':');
                return {
                    name: line.slice(0, idx).trim(),
                    type: line.slice(idx + 1).trim() || 'unknown',
                };
            })
            .filter((r) => isValidRemoteName(r.name));
    }

    async isMountActive(mountPath) {
        const platform = os.platform();
        try {
            if (platform === 'win32') {
                await withTimeout(fs.access(`${mountPath}\\`), 2000);
                return true;
            }
            if (platform === 'linux') {
                const mounts = await fs.readFile('/proc/self/mounts', 'utf8');
                // Mount points in /proc are octal-escaped for spaces etc.
                const escaped = mountPath.replace(/[ \t\n\\]/g, (c) => '\\' + c.charCodeAt(0).toString(8).padStart(3, '0'));
                return mounts.split('\n').some((line) => line.split(' ')[1] === escaped);
            }
            const stdout = await run('mount', [], 3000);
            return stdout.includes(` on ${mountPath} (`);
        } catch {
            return false;
        }
    }

    async getUsedDriveLetters() {
        const used = new Set();
        await Promise.all(Array.from({ length: 26 }, async (_, i) => {
            const letter = String.fromCharCode(65 + i);
            try {
                await withTimeout(fs.access(`${letter}:\\`), 1000);
                used.add(letter);
            } catch { /* free */ }
        }));
        return used;
    }

    async forceUnmount(mountPath) {
        const platform = os.platform();
        if (platform === 'win32') return;
        const attempts = platform === 'darwin'
            ? [['umount', [mountPath]], ['diskutil', ['unmount', 'force', mountPath]]]
            : [['fusermount3', ['-u', mountPath]], ['fusermount', ['-u', mountPath]], ['umount', ['-l', mountPath]]];
        for (const [cmd, args] of attempts) {
            try {
                await run(cmd, args, UNMOUNT_TIMEOUT);
                return;
            } catch { /* try next */ }
        }
    }

    async mountRemote(remoteName, remoteType = 'unknown') {
        if (!isValidRemoteName(remoteName)) {
            throw new Error('Invalid remote name');
        }
        if (this.mounts.has(remoteName)) {
            return { success: true, path: this.mounts.get(remoteName).mountPath, alreadyMounted: true };
        }

        const platform = os.platform();
        let mountPath;
        const args = ['mount', `${remoteName}:`];

        if (platform === 'win32') {
            const usedDrives = await this.getUsedDriveLetters();
            const available = 'ZYXWVUTSRQPONMLKJIHGFEDCB'.split('').find((l) => !usedDrives.has(l));
            if (!available) throw new Error('No free drive letters available for mounting.');
            mountPath = `${available}:`;
            args.push(mountPath, '--vfs-cache-mode', 'full', '--volname', remoteName);
        } else {
            mountPath = path.join(this.baseMountDir, remoteName);

            // Clear a stale mount left behind by a crash, then make sure the folder exists and is empty
            if (await this.isMountActive(mountPath)) {
                await this.forceUnmount(mountPath);
            }
            await fs.mkdir(mountPath, { recursive: true });
            const leftovers = await fs.readdir(mountPath).catch(() => []);
            if (leftovers.length > 0) {
                throw new Error(`Mount folder ${mountPath} is not empty. Move its contents elsewhere and try again.`);
            }
            args.push(mountPath, '--vfs-cache-mode', 'writes');
        }

        // Spawn rclone directly (no shell) so kill() reaches the rclone process itself
        const child = spawn('rclone', args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => {
            stderr = (stderr + chunk.toString()).slice(-4000);
        });

        let exited = false;
        let spawnError = null;
        child.on('error', (err) => { spawnError = err; exited = true; });
        child.on('exit', () => {
            exited = true;
            const info = this.mounts.get(remoteName);
            if (info && info.process === child) {
                console.error(`Rclone mount ${remoteName} terminated:`, stderr.trim());
                this.mounts.delete(remoteName);
                this.saveState();
            }
        });

        // Wait until the OS reports the mount, or rclone exits
        const deadline = Date.now() + MOUNT_READY_TIMEOUT;
        while (Date.now() < deadline) {
            if (exited) break;
            if (await this.isMountActive(mountPath)) {
                this.mounts.set(remoteName, { process: child, mountPath, type: remoteType });
                await this.saveState();
                return { success: true, path: mountPath };
            }
            await sleep(500);
        }

        if (!exited) child.kill();
        if (platform !== 'win32') await fs.rmdir(mountPath).catch(() => {});

        const hint = platform === 'win32' ? ' Check that WinFsp is installed.' : ' Check that FUSE is installed.';
        const detail = spawnError ? spawnError.message : (stderr.trim().split('\n').pop() || 'Mount did not become ready in time.');
        throw new Error(`Failed to mount ${remoteName}: ${detail}${hint}`);
    }

    async unmountRemote(remoteName, { persist = true } = {}) {
        const mountInfo = this.mounts.get(remoteName);
        if (!mountInfo) return { success: true };

        // Remove first so the exit handler does not treat this as a crash
        this.mounts.delete(remoteName);
        const { process: child, mountPath } = mountInfo;

        if (os.platform() !== 'win32') {
            await this.forceUnmount(mountPath);
        }
        if (child && child.exitCode === null) {
            child.kill();
        }
        if (os.platform() !== 'win32') {
            await fs.rmdir(mountPath).catch(() => {});
        }
        if (persist) await this.saveState();
        return { success: true };
    }

    async getMounted() {
        return Promise.all([...this.mounts.entries()].map(async ([name, info]) => ({
            name,
            path: info.mountPath,
            type: info.type || 'unknown',
            isCloud: true,
            ...(await getDriveStats(os.platform() === 'win32' ? `${info.mountPath}\\` : info.mountPath)),
        })));
    }

    async unmountAll() {
        // Keep the saved list so mounts are restored on next launch
        await Promise.allSettled([...this.mounts.keys()].map((name) => this.unmountRemote(name, { persist: false })));
    }

    async saveState() {
        const list = [...this.mounts.entries()].map(([name, info]) => ({ name, type: info.type }));
        try {
            await fs.writeFile(this.stateFile, JSON.stringify(list));
        } catch (error) {
            console.error('Failed to save rclone mount state:', error.message);
        }
    }

    /**
     * Re-mount remotes that were mounted when the app last quit.
     */
    async restoreMounts() {
        let list;
        try {
            list = JSON.parse(await fs.readFile(this.stateFile, 'utf8'));
        } catch {
            return;
        }
        if (!Array.isArray(list) || list.length === 0) return;
        if (!(await this.checkInstalled())) return;

        for (const entry of list) {
            if (!entry || !isValidRemoteName(entry.name)) continue;
            try {
                await this.mountRemote(entry.name, entry.type);
            } catch (error) {
                console.error(error.message);
            }
        }
    }
}

module.exports = RcloneManager;
