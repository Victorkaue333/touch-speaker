// Tray icon pixels, drawn in code: a microphone glyph and, while recording, a dot (docs/DESIGN.md §6.2).
// No image assets from anyone else. No `electron` import, so icon.test.ts can check the pixels.
import { hexToRgb, TRAY_COLORS, type TaskbarTheme } from '../shared/palette';

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

/**
 * Draws the tray icon as a `size`×`size` BGRA bitmap with premultiplied alpha, in the colour variant of
 * the taskbar theme (spec design-system D5): glyph and recording dot from `TRAY_COLORS`.
 */
export function renderTrayBitmap(size: number, recording: boolean, theme: TaskbarTheme): Buffer {
  const glyph = hexToRgb(TRAY_COLORS[theme].glyph);
  const dotColor = hexToRgb(TRAY_COLORS[theme].dot);
  const pixels = Buffer.alloc(size * size * 4);
  const aa = 1 / size; // one pixel of anti-aliasing
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size;
      const y = (py + 0.5) / size;
      let color = glyph;
      let d = micDistance(x, y);
      if (recording) {
        const dot = Math.hypot(x - 0.8, y - 0.2) - 0.17;
        if (dot < d) {
          d = dot;
          color = dotColor;
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
