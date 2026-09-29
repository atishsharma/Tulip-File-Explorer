import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import utils from '../electron/utils.cjs';

const { validateName, isSubPath, uniquePath, parseFrameRate, isSafeExternalUrl, assertPath, withTimeout, mapLimit, isValidRemoteName } = utils;

describe('validateName', () => {
    it('accepts normal names', () => {
        expect(validateName('report.pdf', 'linux')).toBeNull();
        expect(validateName('.bashrc', 'linux')).toBeNull();
    });
    it('rejects empty, dot names and separators', () => {
        expect(validateName('', 'linux')).toBeTruthy();
        expect(validateName('   ', 'linux')).toBeTruthy();
        expect(validateName('..', 'linux')).toBeTruthy();
        expect(validateName('a/b', 'linux')).toBeTruthy();
    });
    it('applies Windows rules', () => {
        expect(validateName('a:b', 'win32')).toBeTruthy();
        expect(validateName('CON', 'win32')).toBeTruthy();
        expect(validateName('name.', 'win32')).toBeTruthy();
        expect(validateName('a:b', 'linux')).toBeNull();
    });
});

describe('isSubPath', () => {
    it('detects nested and equal paths', () => {
        expect(isSubPath('/a/b', '/a/b', 'linux')).toBe(true);
        expect(isSubPath('/a/b', '/a/b/c', 'linux')).toBe(true);
        expect(isSubPath('/a/b', '/a/bc', 'linux')).toBe(false);
        expect(isSubPath('/a/b/c', '/a/b', 'linux')).toBe(false);
    });
});

describe('uniquePath', () => {
    it('adds a counter before the extension', async () => {
        const taken = new Set([path.join('/d', 'New Text Document.txt'), path.join('/d', 'New Text Document (2).txt')]);
        const result = await uniquePath('/d', 'New Text Document.txt', async (p) => taken.has(p));
        expect(result).toBe(path.join('/d', 'New Text Document (3).txt'));
    });
    it('handles folders and dotfiles', async () => {
        const taken = new Set([path.join('/d', 'New Folder'), path.join('/d', '.env')]);
        expect(await uniquePath('/d', 'New Folder', async (p) => taken.has(p))).toBe(path.join('/d', 'New Folder (2)'));
        expect(await uniquePath('/d', '.env', async (p) => taken.has(p))).toBe(path.join('/d', '.env (2)'));
    });
    it('works against the real file system', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tulip-'));
        await fs.writeFile(path.join(dir, 'a.txt'), 'x');
        expect(await uniquePath(dir, 'a.txt')).toBe(path.join(dir, 'a (2).txt'));
        await fs.rm(dir, { recursive: true });
    });
});

describe('parseFrameRate', () => {
    it('parses fractions without eval', () => {
        expect(parseFrameRate('30000/1001')).toBe(29.97);
        expect(parseFrameRate('25/1')).toBe(25);
        expect(parseFrameRate('0/0')).toBeUndefined();
        expect(parseFrameRate('process.exit()')).toBeUndefined();
    });
});

describe('isSafeExternalUrl', () => {
    it('allows only web and mail links', () => {
        expect(isSafeExternalUrl('https://github.com')).toBe(true);
        expect(isSafeExternalUrl('mailto:a@b.c')).toBe(true);
        expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
        expect(isSafeExternalUrl('smb://host/share')).toBe(false);
        expect(isSafeExternalUrl('not a url')).toBe(false);
    });
});

describe('assertPath', () => {
    it('rejects relative and malformed paths', () => {
        expect(() => assertPath('relative/path')).toThrow();
        expect(() => assertPath('/tmp/a\0b')).toThrow();
        expect(() => assertPath(42)).toThrow();
        expect(assertPath(path.resolve('/tmp'))).toBe(path.resolve('/tmp'));
    });
});

describe('isValidRemoteName', () => {
    it('allows rclone names and blocks traversal', () => {
        expect(isValidRemoteName('gdrive')).toBe(true);
        expect(isValidRemoteName('my-drive_2')).toBe(true);
        expect(isValidRemoteName('..')).toBe(false);
        expect(isValidRemoteName('a/b')).toBe(false);
        expect(isValidRemoteName('x"; rm -rf ~')).toBe(false);
    });
});

describe('async helpers', () => {
    it('withTimeout rejects slow promises', async () => {
        await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow('timed out');
        await expect(withTimeout(Promise.resolve(1), 10)).resolves.toBe(1);
    });
    it('mapLimit preserves order and limits concurrency', async () => {
        let active = 0;
        let peak = 0;
        const result = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((r) => setTimeout(r, 5));
            active--;
            return n * 2;
        });
        expect(result).toEqual([2, 4, 6, 8, 10]);
        expect(peak).toBeLessThanOrEqual(2);
    });
});
