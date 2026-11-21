// Generates the Windows .ico (16-256 px), PNG icons and tray icons from the logo SVG.
// The app icon is the light star (#e6e6e6) with a thin dark rim so it also reads on light taskbars.
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets');
const buildDir = path.join(root, 'build');
fs.mkdirSync(buildDir, { recursive: true });

const pathData = fs.readFileSync(path.join(assets, 'logo-light.svg'), 'utf8').match(/ d="([^"]+)"/)[1];
// viewBox of the traced star (from the 512px source)
const VB = { x: 20, y: 28, w: 472, h: 456 };

function svgFor(size, { fill = '#e6e6e6', rim = '#1e1e1e', pad = 0.06 } = {}) {
  // stroke width in viewBox units ~ 1.1 px at this size (min 6 units)
  const unitsPerPx = (VB.w * (1 + 2 * pad)) / size;
  const sw = Math.max(6, unitsPerPx * 1.6);
  const padX = VB.w * pad;
  const vbW = VB.w + 2 * padX;
  const vbH = vbW; // square
  const vbY = VB.y - (vbH - VB.h) / 2;
  const rimPath = rim
    ? `<path d="${pathData}" fill="${rim}" stroke="${rim}" stroke-width="${sw}" stroke-linejoin="round" fill-rule="evenodd"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VB.x - padX} ${vbY} ${vbW} ${vbH}">${rimPath}<path d="${pathData}" fill="${fill}" fill-rule="evenodd"/></svg>`;
}

function png(size, opts) {
  return new Resvg(svgFor(size, opts), { fitTo: { mode: 'width', value: size } }).render().asPng();
}

// ICO container with PNG-compressed entries (supported since Windows Vista)
function ico(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6 + 16 * count);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const icoPngs = sizes.map((size) => ({ size, data: png(size) }));
fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico(icoPngs));
fs.writeFileSync(path.join(buildDir, 'icon.png'), png(512));
fs.writeFileSync(path.join(assets, 'icon.png'), png(256));
fs.writeFileSync(path.join(assets, 'tray.png'), png(32));
fs.writeFileSync(path.join(assets, 'tray@2x.png'), png(64));
fs.writeFileSync(path.join(assets, 'tray.ico'), ico([16, 20, 24, 32].map((size) => ({ size, data: png(size) }))));
// Plain variants for the docs / installer art
fs.writeFileSync(path.join(assets, 'logo-light-256.png'), png(256, { rim: null }));
fs.writeFileSync(path.join(assets, 'logo-dark-256.png'), png(256, { fill: '#2a2e31', rim: null }));
console.log('icons written:', sizes.join(', '));
