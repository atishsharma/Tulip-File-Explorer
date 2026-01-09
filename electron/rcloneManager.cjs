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

        const platform = os.platform();
        let mountPath;
        let command;

        if (platform === 'win32') {
            // Windows: Find first available drive letter backwards from Z
            const usedDrives = await this.getUsedDriveLetters();
            const available = 'ZYXWVUTSRQPONMLKJIHGFEDCBA'.split('').find(l => !usedDrives.has(l));

            if (!available) {
                throw new Error('No free drive letters available for mounting.');
            }

            mountPath = `${available}:`;
            // Use --no-console to hide terminal window, mount to drive letter
            // Add --volname to set the drive label in Windows Explorer
            command = `rclone mount "${remoteName}:" ${mountPath} --vfs-cache-mode full --no-console --volname "${remoteName}"`;
        } else {
            // Linux/Mac: Mount to directory
            mountPath = path.join(this.baseMountDir, remoteName);

            try {
                await fs.mkdir(mountPath, { recursive: true });
            } catch (err) { }

            // Check if directory is empty/mounted
            try {
                const files = await fs.readdir(mountPath);
                if (files.length > 0) {
                    try { await this.unmountRemote(remoteName); } catch (e) { }
                }
            } catch (e) { }

            command = `rclone mount "${remoteName}:" "${mountPath}" --vfs-cache-mode writes`;
        }

        return new Promise((resolve, reject) => {
            console.log(`Executing Rclone: ${command}`);
            // Use spawn for better process control on Windows
            const { spawn } = require('child_process');

            // Parse command string to args for spawn (basic splitting, ideally use a parser)
            // But simple split works for these specific known commands
            // Or just use exec if we don't need detailed stream control yet.
            // Actually, exec is easier for simple start, but spawn is better for long running.
            // Let's stick to exec for simplicity as per existing code structure, 
            // but ensure we don't await completion (it blocks).

            const childProcess = exec(command, (error) => {
                // This callback runs when process terminates
                if (this.mounts.has(remoteName)) {
                    console.error(`Rclone mount ${remoteName} terminated unexpectedly:`, error);
                    this.mounts.delete(remoteName);
                }
            });

            // Wait verification
            setTimeout(async () => {
                const isRunning = childProcess.exitCode === null;
                if (isRunning) {
                    // Verify mount path exists/accessible using fs
                    try {
                        if (platform === 'win32') {
                            // Accessing Z:\ might be slow/block if mount failing?
                            // Just assume success if process running for now, as check might freeze
                        }
                    } catch (e) { }

                    this.mounts.set(remoteName, { process: childProcess, mountPath, type: remoteType });
                    resolve({ success: true, path: mountPath });
                } else {
                    reject(new Error(`Rclone exited immediately. Check if WinFSP is installed.`));
                }
            }, 3000);
        });
    }

    // Helper to find used drive letters on Windows using FS check (No WMIC)
    async getUsedDriveLetters() {
        const used = new Set();
        // Check A-Z
        for (let i = 65; i <= 90; i++) {
            const letter = String.fromCharCode(i);
            const drivePath = `${letter}:\\`;
            try {
                await fs.access(drivePath);
                used.add(letter);
            } catch (e) {
                // Drive not accessible/free
            }
        }
        return used;
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
