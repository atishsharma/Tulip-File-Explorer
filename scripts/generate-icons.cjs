// Regenerates every app icon from the tulip logo so all builds share one square, padded icon.
// Run with: npm run icons   (uses Electron's Chromium canvas; no extra dependencies)
//
// Outputs
//   build/icon.png            1024×1024 master (macOS .icns and Linux icons are derived from it)
//   build/icon.ico            Windows icon, PNG-compressed entries 16–256
//   build/icons/NxN.png       Linux hicolor sizes 16–1024
//   electron/assets/icon.png  512×512 runtime window/taskbar icon
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'src/assets/logo1.png');
const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const PADDING = 0.04; // fraction of the canvas left empty on each side

function buildIco(images) {
    // ICONDIR + one ICONDIRENTRY per image, then the PNG payloads
    const header = Buffer.alloc(6 + images.length * 16);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let offset = header.length;
    images.forEach(({ size, png }, i) => {
        const entry = 6 + i * 16;
        header.writeUInt8(size >= 256 ? 0 : size, entry);
        header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
        header.writeUInt8(0, entry + 2);
        header.writeUInt8(0, entry + 3);
        header.writeUInt16LE(1, entry + 4);
        header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(png.length, entry + 8);
        header.writeUInt32LE(offset, entry + 12);
        offset += png.length;
    });
    return Buffer.concat([header, ...images.map((img) => img.png)]);
}

app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    await win.loadURL('data:text/html,<html><body></body></html>');

    const sourceUrl = `data:image/png;base64,${fs.readFileSync(SOURCE).toString('base64')}`;
    const rendered = await win.webContents.executeJavaScript(`
        (async () => {
            const img = new Image();
            img.src = ${JSON.stringify(sourceUrl)};
            await img.decode();

            // Square 1024 master: logo centred, aspect ratio kept, transparent padding
            const master = document.createElement('canvas');
            master.width = master.height = 1024;
            const m = master.getContext('2d');
            const box = 1024 * (1 - 2 * ${PADDING});
            const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            m.imageSmoothingQuality = 'high';
            m.drawImage(img, (1024 - w) / 2, (1024 - h) / 2, w, h);

            // Downscale in halving steps for crisp small sizes
            const sizeTo = (size) => {
                let current = master;
                while (current.width / 2 >= size) {
                    const next = document.createElement('canvas');
                    next.width = next.height = current.width / 2;
                    const c = next.getContext('2d');
                    c.imageSmoothingQuality = 'high';
                    c.drawImage(current, 0, 0, next.width, next.height);
                    current = next;
                }
                if (current.width !== size) {
                    const exact = document.createElement('canvas');
                    exact.width = exact.height = size;
                    const c = exact.getContext('2d');
                    c.imageSmoothingQuality = 'high';
                    c.drawImage(current, 0, 0, size, size);
                    current = exact;
                }
                return current.toDataURL('image/png');
            };

            const out = {};
            for (const size of ${JSON.stringify(PNG_SIZES)}) out[size] = sizeTo(size);
            return out;
        })()
    `);

    const pngs = Object.fromEntries(Object.entries(rendered).map(([size, url]) => [
        size, Buffer.from(url.split(',')[1], 'base64'),
    ]));

    fs.mkdirSync(path.join(ROOT, 'build/icons'), { recursive: true });
    fs.mkdirSync(path.join(ROOT, 'electron/assets'), { recursive: true });
    for (const size of PNG_SIZES) {
        fs.writeFileSync(path.join(ROOT, `build/icons/${size}x${size}.png`), pngs[size]);
    }
    fs.writeFileSync(path.join(ROOT, 'build/icon.png'), pngs[1024]);
    fs.writeFileSync(path.join(ROOT, 'electron/assets/icon.png'), pngs[512]);
    fs.writeFileSync(path.join(ROOT, 'build/icon.ico'), buildIco(ICO_SIZES.map((size) => ({ size, png: pngs[size] }))));

    console.log(`Icons written from ${path.relative(ROOT, SOURCE)}`);
    app.quit();
});
