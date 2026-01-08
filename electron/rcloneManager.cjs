const { exec } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

class RcloneManager {
    constructor(appPath) {
        this.mounts = new Map(); // remoteName -> { process, mountPath }
        this.baseMountDir = path.join(os.homedir(), 'TulipMounts');
        this.isRcloneAvailable = false;

        // Ensure base mount directory exists
        if (!fsSync.existsSync(this.baseMountDir)) {
            fsSync.mkdirSync(this.baseMountDir, { recursive: true });
        }
    }

    async checkInstalled() {
        return new Promise((resolve) => {
            exec('rclone --version', (error, stdout) => {
                if (error) {
                    this.isRcloneAvailable = false;
                    resolve(false);
                } else {
                    this.isRcloneAvailable = true;
                    resolve(true);
                }
            });
        });
    }

    async listRemotes() {
        if (!this.isRcloneAvailable) return [];

        return new Promise((resolve, reject) => {
            exec('rclone listremotes --long', (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                // Output is like "Drive: drive\nDropbox: dropbox\n"
                const remotes = stdout.split('\n')
                    .map(line => line.trim())
                    .filter(line => line)
                    .map(line => {
                        const parts = line.split(':').map(p => p.trim());
                        return {
                            name: parts[0],
                            type: parts[1] || 'unknown'
                        };
                    });
                resolve(remotes);
            });
        });
    }

    async mountRemote(remoteName, remoteType = 'unknown') {
        if (this.mounts.has(remoteName)) {
            return { success: true, path: this.mounts.get(remoteName).mountPath, alreadyMounted: true };
        }

        const mountPath = path.join(this.baseMountDir, remoteName);

        // Create mount point directory if doesn't exist
        try {
            await fs.mkdir(mountPath, { recursive: true });
        } catch (err) {
            // Ignore if exists
        }

        // Check if directory is empty (safety check)
        const files = await fs.readdir(mountPath);
        if (files.length > 0) {
            // Check if it's already a mount point using 'mount' command or simple heuristic
            // For simplicity, we'll assume if it has files, we might fail or it might be a stale mount
            // Just try to mount over it or error? Let's try to unmount first just in case
            try {
                await this.unmountRemote(remoteName);
            } catch (e) { }
        }

        const platform = os.platform();
        let command;

        if (platform === 'win32') {
            // Windows requires WinFsp and mount command is slightly different usually
            // rclone mount remote: X: --vfs-cache-mode writes
            // For now, let's try mounting to a directory which rclone supports on Windows too if configured right
            command = `rclone mount "${remoteName}:" "${mountPath}" --vfs-cache-mode writes`;
        } else {
            // Linux/Mac
            command = `rclone mount "${remoteName}:" "${mountPath}" --vfs-cache-mode writes --daemon`;
            // --daemon makes it run in background and exit. But we want to track the process?
            // If we use --daemon, we lose track of the PID easily. 
            // Better to run without --daemon and let Electron manage the child process.
            command = `rclone mount "${remoteName}:" "${mountPath}" --vfs-cache-mode writes`;
        }

        return new Promise((resolve, reject) => {
            const childProcess = exec(command, (error) => {
                // This callback runs when process terminates (unexpectedly or expectedly)
                if (this.mounts.has(remoteName)) {
                    console.error(`Rclone mount ${remoteName} terminated unexpectly:`, error);
                    this.mounts.delete(remoteName);
                }
            });

            // Wait a bit to verify mount success (rclone doesn't exit immediately on success without --daemon)
            // Simple heuristic: wait 2 seconds, check if process is still running and mountPath is accessible
            setTimeout(() => {
                if (childProcess.exitCode === null) {
                    this.mounts.set(remoteName, { process: childProcess, mountPath, type: remoteType });
                    resolve({ success: true, path: mountPath });
                } else {
                    reject(new Error('Rclone process exited immediately. Check config or logs.'));
                }
            }, 2000);
        });
    }

    async unmountRemote(remoteName) {
        const mountInfo = this.mounts.get(remoteName);
        const platform = os.platform();

        if (mountInfo && mountInfo.process) {
            mountInfo.process.kill(); // Kill the rclone process
        }

        // Force unmount via system command to be safe
        const mountPath = path.join(this.baseMountDir, remoteName);
        let unmountCmd;
        if (platform === 'darwin') {
            unmountCmd = `umount "${mountPath}"`;
        } else if (platform === 'win32') {
            // Windows rclone usually handles unmount on kill, but can try
            // No standard umount command for directory mounts cleanly without external tools
            unmountCmd = null;
        } else {
            // Linux
            unmountCmd = `fusermount -u "${mountPath}"`;
        }

        if (unmountCmd) {
            try {
                await new Promise(resolve => exec(unmountCmd, resolve));
            } catch (e) {
                console.error('Unmount command failed:', e);
            }
        }

        this.mounts.delete(remoteName);

        // Clean up empty directory
        try {
            await fs.rmdir(mountPath);
        } catch (e) { }

        return { success: true };
    }

    async getDriveStats(drivePath) {
        try {
            const platform = os.platform();
            if (platform === 'win32') {
                return { total: null, free: null };
            } else {
                // Unix-like systems: use df command
                return new Promise((resolve) => {
                    exec(`df -k "${drivePath}"`, (error, stdout) => {
                        if (error) {
                            resolve({ total: null, free: null });
                            return;
                        }
                        try {
                            // Output format: Filesystem 1K-blocks Used Available Use% Mounted on
                            // Tail -1 logic might be flaky if multiple lines match, better to parse stdout
                            const lines = stdout.trim().split('\n');
                            if (lines.length > 1) {
                                const parts = lines[lines.length - 1].trim().split(/\s+/);
                                if (parts.length >= 4) {
                                    const total = parseInt(parts[1]) * 1024;
                                    const used = parseInt(parts[2]) * 1024;
                                    const free = parseInt(parts[3]) * 1024;
                                    resolve({ total, free, used });
                                    return;
                                }
                            }
                            resolve({ total: null, free: null });
                        } catch {
                            resolve({ total: null, free: null });
                        }
                    });
                });
            }
        } catch {
            return { total: null, free: null };
        }
    }

    async getMounted() {
        const mounts = [];
        for (const [name, info] of this.mounts.entries()) {
            const stats = await this.getDriveStats(info.mountPath);
            mounts.push({
                name,
                path: info.mountPath,
                type: info.type || 'unknown',
                ...stats
            });
        }
        return mounts;
    }
    async unmountAll() {
        const promises = [];
        for (const remoteName of this.mounts.keys()) {
            promises.push(this.unmountRemote(remoteName));
        }
        await Promise.all(promises);
    }
}

module.exports = RcloneManager;
