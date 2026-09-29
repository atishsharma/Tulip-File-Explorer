import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getFileKind } from '../src/utils/fileIcons.jsx';
import { computerName } from '../src/hooks/usePlatform.js';

const root = path.resolve(__dirname, '..');

// Width/height from a PNG header (IHDR)
function pngSize(file) {
    const buf = fs.readFileSync(file);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('getFileKind', () => {
    it('maps extensions to badge kinds', () => {
        expect(getFileKind({ isDirectory: true })).toBe('folder');
        expect(getFileKind({ extension: '.PDF' })).toBe('pdf');
        expect(getFileKind({ extension: '.xlsx' })).toBe('sheet');
        expect(getFileKind({ extension: '.mp4' })).toBe('video');
        expect(getFileKind({ extension: '.tar' })).toBe('archive');
        expect(getFileKind({ extension: '.weird' })).toBe('other');
        expect(getFileKind({})).toBe('other');
    });
});

describe('computerName', () => {
    it('names the drives view per OS', () => {
        expect(computerName('darwin')).toBe('This Mac');
        expect(computerName('linux')).toBe('This Computer');
        expect(computerName('win32')).toBe('This PC');
    });
});

describe('app icons', () => {
    it('every Linux icon is square at its named size', () => {
        for (const size of [16, 32, 48, 64, 128, 256, 512, 1024]) {
            expect(pngSize(path.join(root, `build/icons/${size}x${size}.png`))).toEqual({ width: size, height: size });
        }
    });

    it('master, runtime and Windows icons exist', () => {
        expect(pngSize(path.join(root, 'build/icon.png'))).toEqual({ width: 1024, height: 1024 });
        expect(pngSize(path.join(root, 'electron/assets/icon.png'))).toEqual({ width: 512, height: 512 });
        const ico = fs.readFileSync(path.join(root, 'build/icon.ico'));
        expect(ico.readUInt16LE(2)).toBe(1); // icon type
        expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(5); // several sizes
    });

    it('package config points every platform at the Tulip icon', () => {
        const { build } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        expect(build.mac.icon).toBe('build/icon.png');
        expect(build.win.icon).toBe('build/icon.ico');
        expect(build.linux.icon).toBe('build/icons');
        expect(build.linux.target.map((t) => t.target)).toContain('tar.gz');
    });
});
