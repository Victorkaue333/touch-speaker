// Tray icon drawn in code: a microphone glyph (docs/DESIGN.md §6). No image assets from anyone else.
import { nativeImage, type NativeImage } from 'electron';

const GLYPH = { r: 0x13, g: 0xa8, b: 0x9e }; // --ts-listening
const DOT = { r: 0xf8, g: 0x71, b: 0x71 }; // recording indicator

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Signed distance (in unit coordinates) to the microphone glyph; negative = inside. */
function micDistance(x: number, y: number): number {
  const stroke = 0.045;
  const capsule = segmentDistance(x, y, 0.5, 0.26, 0.5, 0.46) - 0.15;
  const ringRadius = 0.25;
  const ring = y >= 0.46 ? Math.abs(Math.hypot(x - 0.5, y - 0.46) - ringRadius) - stroke : Number.POSITIVE_INFINITY;
  const ringTips = Math.min(
    segmentDistance(x, y, 0.25, 0.4, 0.25, 0.46),
    segmentDistance(x, y, 0.75, 0.4, 0.75, 0.46),
  ) - stroke;
  const stem = segmentDistance(x, y, 0.5, 0.71, 0.5, 0.84) - stroke;
  const base = segmentDistance(x, y, 0.36, 0.86, 0.64, 0.86) - stroke;
  return Math.min(capsule, ring, ringTips, stem, base);
}

function render(size: number, recording: boolean): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const aa = 1 / size; // one pixel of anti-aliasing
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size;
      const y = (py + 0.5) / size;
      let color = GLYPH;
      let d = micDistance(x, y);
      if (recording) {
        const dot = Math.hypot(x - 0.8, y - 0.2) - 0.17;
        if (dot < d) {
          d = dot;
          color = DOT;
        }
      }
      const alpha = Math.max(0, Math.min(1, 0.5 - d / aa));
      const o = (py * size + px) * 4;
      // BGRA, premultiplied alpha.
      pixels[o] = Math.round(color.b * alpha);
      pixels[o + 1] = Math.round(color.g * alpha);
      pixels[o + 2] = Math.round(color.r * alpha);
      pixels[o + 3] = Math.round(255 * alpha);
    }
  }
  return pixels;
}

export function trayIcon(recording: boolean): NativeImage {
  const image = nativeImage.createFromBitmap(render(16, recording), { width: 16, height: 16, scaleFactor: 1 });
  for (const scale of [1.5, 2]) {
    const size = 16 * scale;
    image.addRepresentation({ scaleFactor: scale, width: size, height: size, buffer: render(size, recording) });
  }
  return image;
}
