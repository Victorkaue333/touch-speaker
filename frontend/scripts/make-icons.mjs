// Draws the app icon from the brand mark of docs/assets/logo.svg (the teal rounded square with the white
// microphone) and writes build/icon.png (1024 px, macOS) and build/icon.ico (16…256 px, Windows) for
// electron-builder (spec distribuicao-windows-macos §7, ADR-10). Provisional art until the design-system spec
// brings the final one. Pixels are computed here, from the logo's own geometry — no rasterizer dependency,
// no third-party asset. Deterministic: the same code always writes the same bytes.
//
// Run: node scripts/make-icons.mjs   (the files are committed; rerun only when the mark changes)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'build');

const TEAL = { r: 0x13, g: 0xa8, b: 0x9e };
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

// ---- Geometry of logo.svg, in units of its 160 px square (x/y 20…180) --------------------------------

const u = (v) => (v - 20) / 160;

function segment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function roundedSquare(x, y, radius) {
  const qx = Math.abs(x - 0.5) - (0.5 - radius);
  const qy = Math.abs(y - 0.5) - (0.5 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

const STROKE = 5 / 160; // stroke-width 10 → half width

/** The white microphone: capsule, U-shaped holder (lower half circle), stem and base. Negative = inside. */
function mic(x, y) {
  const capsule = segment(x, y, u(100), u(64), u(100), u(94)) - 16 / 160;
  const cx = u(100);
  const cy = u(92);
  const holder = y >= cy ? Math.abs(Math.hypot(x - cx, y - cy) - 30 / 160) - STROKE : Number.POSITIVE_INFINITY;
  const holderTips = Math.min(segment(x, y, u(70), u(92), u(70), u(92)), segment(x, y, u(130), u(92), u(130), u(92))) - STROKE;
  const stem = segment(x, y, u(100), u(122), u(100), u(146)) - STROKE;
  const base = segment(x, y, u(82), u(148), u(118), u(148)) - STROKE;
  return Math.min(capsule, holder, holderTips, stem, base);
}

/** The two sound bars beside the microphone (opacity 0.55 in the logo). */
function bars(x, y) {
  const r = 3 / 160;
  return Math.min(segment(x, y, u(145), u(79), u(145), u(93)) - r, segment(x, y, u(157), u(71), u(157), u(101)) - r);
}

/**
 * Straight (not premultiplied) RGBA pixels, top row first. `margin` is the empty border on each side, as a
 * fraction of `size` (macOS icons leave room around the shape; Windows icons fill the square).
 */
function render(size, margin) {
  const pixels = Buffer.alloc(size * size * 4);
  const span = 1 - 2 * margin;
  const aa = 1 / (size * span);
  const cover = (d) => Math.max(0, Math.min(1, 0.5 - d / aa));
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = ((px + 0.5) / size - margin) / span;
      const y = ((py + 0.5) / size - margin) / span;
      const bgA = cover(roundedSquare(x, y, 0.25));
      // White over teal, both clipped to the square: colour = mix, alpha = the square's.
      const fg = Math.min(bgA, Math.max(cover(mic(x, y)), 0.55 * cover(bars(x, y))));
      const mix = bgA > 0 ? fg / bgA : 0;
      const o = (py * size + px) * 4;
      pixels[o] = Math.round(TEAL.r + (WHITE.r - TEAL.r) * mix);
      pixels[o + 1] = Math.round(TEAL.g + (WHITE.g - TEAL.g) * mix);
      pixels[o + 2] = Math.round(TEAL.b + (WHITE.b - TEAL.b) * mix);
      pixels[o + 3] = Math.round(255 * bgA);
    }
  }
  return pixels;
}

// ---- PNG (RGBA, 8 bit) -------------------------------------------------------------------------------

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- ICO: 32-bit DIB entries up to 128 px, PNG for 256 px ---------------------------------------------

function dib(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // XOR + AND masks
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size * 4; // bottom-up
    for (let x = 0; x < size; x++) {
      const s = src + x * 4;
      const d = (y * size + x) * 4;
      xor[d] = rgba[s + 2]; // B
      xor[d + 1] = rgba[s + 1]; // G
      xor[d + 2] = rgba[s]; // R
      xor[d + 3] = rgba[s + 3]; // A
    }
  }
  const andRow = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, xor, Buffer.alloc(andRow * size)]);
}

function ico(sizes) {
  const images = sizes.map((size) => {
    const rgba = render(size, 0);
    return { size, data: size >= 256 ? png(size, rgba) : dib(size, rgba) };
  });
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(16 * images.length);
  let offset = 6 + entries.length;
  images.forEach(({ size, data }, i) => {
    const e = i * 16;
    entries[e] = size >= 256 ? 0 : size;
    entries[e + 1] = size >= 256 ? 0 : size;
    entries.writeUInt16LE(1, e + 4); // planes
    entries.writeUInt16LE(32, e + 6); // bits per pixel
    entries.writeUInt32LE(data.length, e + 8);
    entries.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, entries, ...images.map((i) => i.data)]);
}

mkdirSync(outDir, { recursive: true });
// macOS app icon grid: the shape sits inside ~80% of the canvas.
writeFileSync(join(outDir, 'icon.png'), png(1024, render(1024, 0.1)));
writeFileSync(join(outDir, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]));
console.log('build/icon.png and build/icon.ico written');
