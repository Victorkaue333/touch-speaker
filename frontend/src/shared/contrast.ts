// Contrast ratio from WCAG 2.x (relative luminance in sRGB). Pure: used by tokens.test.ts and
// icon.test.ts to hold every colour pair of spec design-system §9.4 at its threshold (FR-DS-17).
import { hexToRgb } from './palette';

/** WCAG 1.4.3 — text against its background. */
export const TEXT_MIN_CONTRAST = 4.5;
/** WCAG 1.4.11 — graphics and component edges against their background. */
export const GRAPHIC_MIN_CONTRAST = 3;

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#RRGGBB` colour, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Contrast ratio between two `#RRGGBB` colours, from 1 to 21, unrounded. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
