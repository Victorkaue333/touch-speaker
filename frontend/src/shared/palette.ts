// The Sálvia colours the main process needs to draw the tray icon (docs/DESIGN.md §6.2). The main
// process cannot read CSS, so these hex values repeat src/renderer/tokens.css; tokens.test.ts fails if
// the two files diverge (spec design-system, RISK-novo-1).

/** The palette primitives (spec design-system §9.2, plus the brand teal of D12) — the `--ts-palette-*` tokens. */
export const PALETTE = {
  alabaster: '#F4F1EB',
  candle: '#EFE9D7',
  blackHole: '#222222',
  slateGreen: '#2D5A4A',
  mossGreen: '#7AA05A',
  apricot: '#D78B30',
  /** The brand teal of docs/assets/logo.svg: dark-theme accent and recording, tray glyph on a dark bar. */
  teal: '#13A89E',
} as const;

/** Approved derived shades used outside CSS (spec design-system §9.3, D5 and D8). */
export const DERIVED = {
  /** Light-theme `--ts-bg`: neutral white since 18/out/2026 — the main window's frame before the page paints. */
  bgLight: '#FFFFFF',
  /** Light-theme `--ts-accent`: the brand teal darkened, same hue — the tray glyph on a light bar. */
  tealLight: '#0D7A72',
  /** Apricot darkened, same hue: the tray's recording dot on a light bar, apart from the teal glyph. */
  apricotDark: '#BB7624',
  /** `--ts-border-strong`: the neutral tray glyph when the taskbar theme cannot be read. */
  neutral: '#817F7C',
} as const;

/** Taskbar theme as read from Windows ("modo do Windows"), or `unknown` when it cannot be read. */
export type TaskbarTheme = 'dark' | 'light' | 'unknown';

export interface TrayColors {
  glyph: string;
  dot: string;
}

/**
 * Tray icon colours per taskbar theme; each passes 3:1 against its bar (spec design-system D5, D12). The glyph is
 * the brand teal; the recording dot stays Apricot so it still reads apart from a teal glyph.
 */
export const TRAY_COLORS: Readonly<Record<TaskbarTheme, TrayColors>> = {
  dark: { glyph: PALETTE.teal, dot: PALETTE.apricot },
  light: { glyph: DERIVED.tealLight, dot: DERIVED.apricotDark },
  unknown: { glyph: DERIVED.neutral, dot: DERIVED.apricotDark },
};

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses `#RRGGBB` (case-insensitive). Throws on anything else: palette values are constants. */
export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}
