import { describe, it, expect } from 'vitest';
import { splitPath, getParentPath, isRootPath, fileUrl, THIS_PC } from '../src/utils/paths.js';

describe('splitPath', () => {
    it('splits POSIX paths', () => {
        expect(splitPath('/home/user')).toEqual([
            { name: 'home', path: '/home' },
            { name: 'user', path: '/home/user' },
        ]);
    });
    it('splits Windows paths', () => {
        expect(splitPath('C:\\Users\\me')).toEqual([
            { name: 'C:', path: 'C:\\' },
            { name: 'Users', path: 'C:\\Users' },
            { name: 'me', path: 'C:\\Users\\me' },
        ]);
    });
    it('keeps UNC roots intact', () => {
        expect(splitPath('\\\\server\\share\\docs')).toEqual([
            { name: '\\\\server\\share', path: '\\\\server\\share\\' },
            { name: 'docs', path: '\\\\server\\share\\docs' },
        ]);
    });
    it('returns nothing for This PC', () => {
        expect(splitPath(THIS_PC)).toEqual([]);
    });
});

describe('getParentPath / isRootPath', () => {
    it('handles roots', () => {
        expect(isRootPath('/')).toBe(true);
        expect(isRootPath('C:\\')).toBe(true);
        expect(isRootPath('\\\\server\\share\\')).toBe(true);
        expect(isRootPath(THIS_PC)).toBe(true);
        expect(getParentPath('/')).toBeNull();
    });
    it('goes up one level', () => {
        expect(getParentPath('/home')).toBe('/');
        expect(getParentPath('/home/user')).toBe('/home');
        expect(getParentPath('C:\\Users')).toBe('C:\\');
        expect(getParentPath('\\\\server\\share\\docs')).toBe('\\\\server\\share\\');
    });
});

describe('fileUrl', () => {
    it('encodes special characters', () => {
        expect(fileUrl('/tmp/a #1?.mp4')).toBe('tulip-file://local/%2Ftmp%2Fa%20%231%3F.mp4');
        expect(decodeURIComponent(new URL(fileUrl('C:\\x\\y.png')).pathname.slice(1))).toBe('C:\\x\\y.png');
    });
});
