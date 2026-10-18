import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderTrayBitmap } from '../main/icon-bitmap';
import { contrastRatio, GRAPHIC_MIN_CONTRAST } from '../shared/contrast';
import { TRAY_COLORS, type TaskbarTheme } from '../shared/palette';

// Spec docs/spec/features/design-system.md — §14 crit. 14 and 15 (FR-DS-14, FR-DS-15), decision D5.
const SIZES = [16, 24, 32]; // 100%, 150% and 200% (icon.ts)
const WHITE = '#FFFFFF';
const BLACK = '#000000';

/** Expected colours, written out here so the test does not just repeat TRAY_COLORS. */
const EXPECTED: Record<TaskbarTheme, { glyph: string; dot: string }> = {
  dark: { glyph: '#13A89E', dot: '#D78B30' }, // brand teal, Apricot
  light: { glyph: '#0D7A72', dot: '#BB7624' }, // darker brand teal, darker Apricot
  unknown: { glyph: '#817F7C', dot: '#BB7624' }, // neutral fallback
};
const THEMES = Object.keys(EXPECTED) as TaskbarTheme[];

/** Colour of the pixel under unit coordinates (x, y), un-premultiplied, as #RRGGBB plus alpha. */
function pixelAt(bitmap: Buffer, size: number, x: number, y: number): { hex: string; alpha: number } {
  const o = (Math.floor(y * size) * size + Math.floor(x * size)) * 4;
  const [b = 0, g = 0, r = 0, a = 0] = bitmap.subarray(o, o + 4);
  const hex = (v: number) => Math.round(a === 0 ? 0 : (v * 255) / a).toString(16).padStart(2, '0');
  return { hex: `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase(), alpha: a };
}

const DOT_CENTRE = { x: 0.8, y: 0.2 };
const GLYPH_BODY = { x: 0.5, y: 0.36 }; // inside the microphone capsule

describe('tray icon pixels (FR-DS-14, FR-DS-15)', () => {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      it(`${theme} taskbar, ${size} px: glyph in ${EXPECTED[theme].glyph}, recording dot in ${EXPECTED[theme].dot}`, () => {
        const recording = renderTrayBitmap(size, true, theme);
        assert.deepEqual(pixelAt(recording, size, DOT_CENTRE.x, DOT_CENTRE.y), { hex: EXPECTED[theme].dot, alpha: 255 });
        assert.deepEqual(pixelAt(recording, size, GLYPH_BODY.x, GLYPH_BODY.y), { hex: EXPECTED[theme].glyph, alpha: 255 });

        const idle = renderTrayBitmap(size, false, theme);
        assert.equal(pixelAt(idle, size, DOT_CENTRE.x, DOT_CENTRE.y).alpha, 0, 'no dot while idle');
        assert.deepEqual(pixelAt(idle, size, GLYPH_BODY.x, GLYPH_BODY.y), { hex: EXPECTED[theme].glyph, alpha: 255 });
      });
    }
  }

  it('the recording dot is never the error red of Fase 1 (#F87171)', () => {
    for (const theme of THEMES) {
      const bitmap = renderTrayBitmap(32, true, theme);
      for (let py = 0; py < 32; py++) {
        for (let px = 0; px < 32; px++) {
          const { hex, alpha } = pixelAt(bitmap, 32, (px + 0.5) / 32, (py + 0.5) / 32);
          if (alpha === 255) assert.notEqual(hex, '#F87171');
        }
      }
    }
  });

  it('TRAY_COLORS is what the bitmap draws', () => {
    for (const theme of THEMES) {
      assert.equal(TRAY_COLORS[theme].glyph.toUpperCase(), EXPECTED[theme].glyph);
      assert.equal(TRAY_COLORS[theme].dot.toUpperCase(), EXPECTED[theme].dot);
    }
  });
});

describe('tray icon contrast against the taskbar (FR-DS-15, D5)', () => {
  // The real taskbar colour is measured by hand in V-DS-2; black and white are the extremes.
  const bars: Record<TaskbarTheme, string[]> = { dark: [BLACK], light: [WHITE], unknown: [BLACK, WHITE] };
  for (const theme of THEMES) {
    it(`${theme} taskbar: glyph and dot ≥ ${GRAPHIC_MIN_CONTRAST}:1`, () => {
      for (const bar of bars[theme]) {
        for (const part of ['glyph', 'dot'] as const) {
          const ratio = contrastRatio(TRAY_COLORS[theme][part], bar);
          assert.ok(ratio >= GRAPHIC_MIN_CONTRAST, `${part} on ${bar}: ${ratio.toFixed(2)}:1`);
        }
      }
    });
  }
});
