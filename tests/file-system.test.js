import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import fileSystem from '../electron/fileSystem.cjs';

const posixOnly = process.platform === 'win32' ? it.skip : it;
let dir;

beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tulip-fs-'));
});

afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
});

describe('readDirectory', () => {
    posixOnly('treats symlinked folders as folders and flags broken links', async () => {
        await fs.mkdir(path.join(dir, 'real'));
        await fs.symlink(path.join(dir, 'real'), path.join(dir, 'link'));
        await fs.symlink(path.join(dir, 'missing'), path.join(dir, 'broken'));
        await fs.writeFile(path.join(dir, 'file.TXT'), 'hi');

        const result = await fileSystem.readDirectory(dir);
        expect(result.success).toBe(true);
        const byName = Object.fromEntries(result.items.map((i) => [i.name, i]));
        expect(byName.link.isDirectory).toBe(true);
        expect(byName.link.isSymlink).toBe(true);
        expect(byName.broken.error).toBe(true);
        expect(byName['file.TXT'].extension).toBe('.txt');
        // Folders sort first
        expect(result.items[0].isDirectory).toBe(true);
    });
});

describe('setHiddenAttribute', () => {
    posixOnly('never overwrites an existing dotfile', async () => {
        await fs.writeFile(path.join(dir, 'notes'), 'visible');
        await fs.writeFile(path.join(dir, '.notes'), 'hidden');
        const result = await fileSystem.setHiddenAttribute(path.join(dir, 'notes'), true);
        expect(result.success).toBe(false);
        expect(await fs.readFile(path.join(dir, '.notes'), 'utf8')).toBe('hidden');
    });

    posixOnly('returns the new path after hiding', async () => {
        await fs.writeFile(path.join(dir, 'a'), '');
        const result = await fileSystem.setHiddenAttribute(path.join(dir, 'a'), true);
        expect(result).toEqual({ success: true, newPath: path.join(dir, '.a') });
    });
});

describe('calculateFolderStats', () => {
    it('counts files and supports cancellation', async () => {
        await fs.mkdir(path.join(dir, 'sub'));
        await fs.writeFile(path.join(dir, 'sub', 'x'), '12345');
        await fs.writeFile(path.join(dir, 'y'), '12');
        expect(await fileSystem.calculateFolderStats(dir)).toEqual({ size: 7, files: 2, folders: 1, cancelled: false });
        const cancelled = await fileSystem.calculateFolderStats(dir, () => true);
        expect(cancelled.cancelled).toBe(true);
    });
});

describe('getContentInfo', () => {
    it('reports read-only files', async () => {
        const file = path.join(dir, 'ro.txt');
        await fs.writeFile(file, 'x');
        await fs.chmod(file, 0o444);
        const info = await fileSystem.getContentInfo(file);
        // root ignores permission bits, so only assert when not running as root
        if (process.getuid?.() !== 0) expect(info.readOnly).toBe(true);
        expect(info.type).toBe('file');
    });
});
