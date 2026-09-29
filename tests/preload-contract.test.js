import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Every window.electronAPI call in the renderer must exist in the preload bridge,
// and every channel the preload invokes must have a handler in the main process.
const root = path.resolve(__dirname, '..');
const preload = fs.readFileSync(path.join(root, 'electron/preload.cjs'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron/main.cjs'), 'utf8');

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : /\.(jsx?|tsx?)$/.test(e.name) ? [full] : [];
    });
}

describe('preload contract', () => {
    it('exposes every API the renderer calls', () => {
        const used = new Set();
        for (const file of walk(path.join(root, 'src'))) {
            const src = fs.readFileSync(file, 'utf8');
            for (const m of src.matchAll(/electronAPI\??\.(\w+)(?:\??\.(\w+))?/g)) {
                used.add(m[1] === 'rclone' && m[2] ? `rclone.${m[2]}` : m[1]);
            }
        }
        const missing = [...used].filter((name) => {
            const key = name.startsWith('rclone.') ? name.slice(7) : name;
            return !new RegExp(`\\b${key}\\s*:`).test(preload);
        });
        expect(missing).toEqual([]);
    });

    it('has a main-process handler for every invoked channel', () => {
        const channels = [...preload.matchAll(/ipcRenderer\.(?:invoke|send)\('([^']+)'/g)].map((m) => m[1]);
        const missing = channels.filter((c) => !main.includes(`'${c}'`));
        expect(missing).toEqual([]);
    });
});
