import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { contrastRatio, GRAPHIC_MIN_CONTRAST, TEXT_MIN_CONTRAST } from '../shared/contrast';
import { DERIVED, PALETTE, TRAY_COLORS } from '../shared/palette';

// Spec docs/spec/features/design-system.md — §9.3 (tokens), §9.4 B (contrast), §9.5 (base), §14 crit. 1, 2,
// 17 and 18, RISK-novo-1 and RISK-novo-3. Reads the sources, not dist/ (dist/test runs from frontend/dist).
const SRC = path.join(__dirname, '..', '..', 'src');
const RENDERER = path.join(SRC, 'renderer');
const DIST_RENDERER = path.join(__dirname, '..', 'renderer');

const read = (file: string) => readFileSync(path.join(RENDERER, file), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

interface CssBlock {
  prelude: string;
  body: string;
}

/** Top-level blocks of a stylesheet (`prelude { body }`), with nested braces kept inside `body`. */
function cssBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      if (depth === 0) open = i;
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        blocks.push({ prelude: css.slice(start, open).trim(), body: css.slice(open + 1, i) });
        start = i + 1;
      }
    }
  }
  assert.equal(depth, 0, 'unbalanced braces');
  return blocks;
}

/** Custom properties declared directly in a block body. */
function customProperties(body: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) {
      assert.ok(!props.has(name), `${name} declared twice in one block`);
      props.set(name, value.trim());
    }
  }
  return props;
}

const tokensCss = stripComments(read('tokens.css'));
const topBlocks = cssBlocks(tokensCss);

const light = new Map<string, string>();
for (const block of topBlocks.filter((b) => b.prelude === ':root')) {
  for (const [name, value] of customProperties(block.body)) {
    assert.ok(!light.has(name), `${name} declared twice in :root`);
    light.set(name, value);
  }
}

const darkMedia = topBlocks.filter((b) => /^@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)$/.test(b.prelude));
assert.equal(darkMedia.length, 1, 'tokens.css needs exactly one @media (prefers-color-scheme: dark)');
const darkRoots = cssBlocks(darkMedia[0]?.body ?? '').filter((b) => b.prelude === ':root');
assert.equal(darkRoots.length, 1, 'the dark media query needs exactly one :root');
const dark = customProperties(darkRoots[0]?.body ?? '');

type Theme = 'light' | 'dark';
const THEMES: readonly Theme[] = ['light', 'dark'];

/** Value of a token in a theme, following `var(--…)` references; the dark theme falls back to :root. */
function resolve(token: string, theme: Theme, seen: string[] = []): string {
  assert.ok(!seen.includes(token), `circular var(): ${[...seen, token].join(' → ')}`);
  const raw = (theme === 'dark' ? dark.get(token) : undefined) ?? light.get(token);
  assert.ok(raw !== undefined, `${token} is not defined for the ${theme} theme`);
  const ref = /^var\((--[\w-]+)\)$/.exec(raw);
  return ref?.[1] ? resolve(ref[1], theme, [...seen, token]) : raw.toLowerCase();
}

function hexOf(token: string, theme: Theme): string {
  const value = resolve(token, theme);
  assert.match(value, /^#[0-9a-f]{6}$/, `${token} (${theme}) must resolve to #rrggbb, got ${value}`);
  return value;
}

/** §9.3: the semantic tokens, defined once per theme. */
const SEMANTIC = [
  '--ts-bg',
  '--ts-surface',
  '--ts-card',
  '--ts-hover',
  '--ts-text',
  '--ts-text-muted',
  '--ts-accent',
  '--ts-accent-fill',
  '--ts-on-accent',
  '--ts-secondary-fill',
  '--ts-on-secondary',
  '--ts-border',
  '--ts-border-strong',
  '--ts-focus',
  '--ts-recording',
  '--ts-working',
  '--ts-notice',
  '--ts-error',
  '--ts-pill-surface',
  '--ts-pill-border',
];

/** §9.5: the base for the main window (plus the pill's own pulse durations). Defined once, in :root. */
const BASE = [
  '--ts-font-sans',
  '--ts-font-size-xs',
  '--ts-font-size-sm',
  '--ts-font-size-md',
  '--ts-font-size-lg',
  '--ts-font-size-xl',
  '--ts-font-weight-regular',
  '--ts-font-weight-medium',
  '--ts-font-weight-semibold',
  '--ts-space-1',
  '--ts-space-2',
  '--ts-space-3',
  '--ts-space-4',
  '--ts-space-5',
  '--ts-space-6',
  '--ts-radius-sm',
  '--ts-radius-md',
  '--ts-radius-pill',
  '--ts-shadow-float',
  '--ts-duration-enter',
  '--ts-duration-exit',
  '--ts-focus-ring',
  '--ts-focus-ring-offset',
];
const PILL_ONLY_BASE = ['--ts-duration-pulse', '--ts-duration-pulse-stagger'];

/** `PALETTE` key → primitive token. */
const PRIMITIVE_TOKEN: Record<keyof typeof PALETTE, string> = {
  alabaster: '--ts-palette-alabaster',
  candle: '--ts-palette-candle',
  blackHole: '--ts-palette-black-hole',
  slateGreen: '--ts-palette-slate-green',
  mossGreen: '--ts-palette-moss-green',
  apricot: '--ts-palette-apricot',
  teal: '--ts-palette-teal',
};

describe('tokens.css: themes (FR-DS-02, FR-DS-05)', () => {
  it('the dark theme defines exactly the semantic tokens of §9.3', () => {
    assert.deepEqual([...dark.keys()].sort(), [...SEMANTIC].sort());
  });

  it('the light theme defines the same semantic tokens, and :root holds nothing else but primitives and base', () => {
    for (const token of SEMANTIC) assert.ok(light.has(token), `${token} missing from the light theme`);
    const allowed = new Set([...SEMANTIC, ...BASE, ...PILL_ONLY_BASE, ...Object.values(PRIMITIVE_TOKEN)]);
    for (const token of light.keys()) assert.ok(allowed.has(token), `unexpected token in :root: ${token}`);
  });

  it('the pill surface is --ts-bg in both themes (opaque, D3)', () => {
    assert.equal(light.get('--ts-pill-surface'), 'var(--ts-bg)');
    assert.equal(dark.get('--ts-pill-surface'), 'var(--ts-bg)');
    assert.equal(light.get('--ts-pill-border'), 'var(--ts-border)');
    assert.equal(dark.get('--ts-pill-border'), 'var(--ts-border)');
  });

  it('every colour token resolves to an opaque #rrggbb in both themes', () => {
    for (const theme of THEMES) for (const token of SEMANTIC) hexOf(token, theme);
  });

  it('the manual-theme blocks (data-theme) repeat the light and dark themes exactly (FR-UI-39…42)', () => {
    for (const theme of THEMES) {
      const blocks = topBlocks.filter((b) => b.prelude === `:root[data-theme='${theme}']`);
      assert.equal(blocks.length, 1, `tokens.css needs exactly one :root[data-theme='${theme}']`);
      const manual = customProperties(blocks[0]?.body ?? '');
      const auto = theme === 'dark' ? dark : new Map(SEMANTIC.map((t) => [t, light.get(t) ?? '']));
      assert.deepEqual(new Map([...manual].sort()), new Map([...auto].sort()), `data-theme='${theme}' drifted`);
    }
  });

  it('the light theme is neutral white: white page and cards, light grey surface (Victor, 18/out/2026)', () => {
    assert.equal(hexOf('--ts-bg', 'light'), '#ffffff');
    assert.equal(hexOf('--ts-card', 'light'), '#ffffff');
    assert.equal(hexOf('--ts-surface', 'light'), '#f7f7f8');
    assert.equal(hexOf('--ts-hover', 'light'), '#f4f4f5');
    assert.equal(hexOf('--ts-border', 'light'), '#e4e4e7');
    assert.equal(hexOf('--ts-text-muted', 'light'), '#65656d');
  });

  it('the dark theme keeps card = surface and hover = bg (unchanged look)', () => {
    assert.equal(hexOf('--ts-card', 'dark'), hexOf('--ts-surface', 'dark'));
    assert.equal(hexOf('--ts-hover', 'dark'), hexOf('--ts-bg', 'dark'));
  });
});

describe('tokens.css: base for the main window (FR-DS-18)', () => {
  it('defines every token of §9.5', () => {
    for (const token of [...BASE, ...PILL_ONLY_BASE]) assert.ok(light.has(token), `${token} missing`);
  });

  it('Inter comes first, with the fallback stack of the Fase 1 pill (FR-DS-11, FR-DS-12)', () => {
    assert.equal(light.get('--ts-font-sans'), "'Inter', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif");
  });

  it('Inter is a local file with font-display: swap, and its OFL licence sits next to it (FR-DS-11, RISK-novo-3)', () => {
    const faces = topBlocks.filter((b) => b.prelude === '@font-face');
    assert.equal(faces.length, 1);
    const face = faces[0]?.body ?? '';
    assert.match(face, /font-family:\s*'Inter'/);
    assert.match(face, /font-display:\s*swap/);
    const url = /src:\s*url\('([^']+)'\)/.exec(face)?.[1];
    assert.equal(url, 'fonts/InterVariable.woff2');
    assert.ok(existsSync(path.join(RENDERER, url)), 'font file missing from src/renderer/fonts');
    assert.ok(existsSync(path.join(RENDERER, 'fonts', 'OFL.txt')), 'OFL.txt missing from src/renderer/fonts');
  });

  it('copy-static.mjs puts the font and the licence in dist/renderer/fonts', () => {
    assert.ok(existsSync(path.join(DIST_RENDERER, 'fonts', 'InterVariable.woff2')));
    assert.ok(existsSync(path.join(DIST_RENDERER, 'fonts', 'OFL.txt')));
  });

  it('no stylesheet points to the network', () => {
    for (const file of ['tokens.css', 'pill.css']) {
      assert.doesNotMatch(stripComments(read(file)), /https?:|\/\/|@import/i, `${file} must stay local`);
    }
  });
});

describe('pill.css and pill.html on the tokens (FR-DS-01)', () => {
  const pillCss = stripComments(read('pill.css'));

  it('has no literal colour: every colour is var(--ts-…)', () => {
    assert.doesNotMatch(pillCss, /#[0-9a-f]{3,8}\b/i);
    assert.doesNotMatch(pillCss, /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i);
  });

  it('defines no token of its own (no palette per window)', () => {
    assert.doesNotMatch(pillCss, /--[\w-]+\s*:/);
  });

  it('takes font family and durations from tokens', () => {
    for (const match of pillCss.matchAll(/font-family:\s*([^;]+);/g)) assert.match(match[1] ?? '', /^var\(--ts-[\w-]+\)$/);
    assert.doesNotMatch(pillCss, /\d+m?s\b/, 'durations come from --ts-duration-*');
  });

  it('pill.html loads tokens.css before pill.css, with the CSP unchanged', () => {
    const html = read('pill.html');
    const tokensAt = html.indexOf('href="tokens.css"');
    const pillAt = html.indexOf('href="pill.css"');
    assert.ok(tokensAt > 0 && pillAt > tokensAt, 'tokens.css must come before pill.css');
    assert.ok(
      html.includes(
        `content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; media-src 'self' blob: mediastream:"`,
      ),
      'CSP changed',
    );
  });
});

// Spec docs/spec/features/janela-principal.md §6 (NFR "Tema" and "Segurança Electron"), §8 ("Build do renderer").
describe('main window on the tokens, with its CSP (FR-DS-01, FR-UI-34, NFR-05)', () => {
  const css = stripComments(read(path.join('main-window', 'main-window.css')));
  const html = read(path.join('main-window', 'index.html'));

  it('main-window.css has no literal colour, no token of its own, no literal duration and nothing from the network', () => {
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
    assert.doesNotMatch(css, /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i);
    assert.doesNotMatch(css, /--[\w-]+\s*:/);
    assert.doesNotMatch(css, /\d+m?s\b/, 'durations come from --ts-duration-*');
    assert.doesNotMatch(css, /https?:|\/\/|@import/i);
    for (const match of css.matchAll(/font-family:\s*([^;]+);/g)) assert.match(match[1] ?? '', /^var\(--ts-[\w-]+\)$/);
  });

  it('index.html loads ../tokens.css before main-window.css, with the strict CSP of the spec', () => {
    const tokensAt = html.indexOf('href="../tokens.css"');
    const ownAt = html.indexOf('href="main-window.css"');
    assert.ok(tokensAt > 0 && ownAt > tokensAt, 'tokens.css must come before main-window.css');
    assert.ok(
      html.includes(
        `content="default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"`,
      ),
      'CSP changed',
    );
    assert.doesNotMatch(html, /'unsafe-inline'|<style|\sstyle=|\son[a-z]+=/i, 'no inline style or handler');
  });

  it('index.html has no interface text: every text comes from app:get-strings (FR-UI-10)', () => {
    const body = html.slice(html.indexOf('<body>')).replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
    const text = body.replace(/<[^>]+>/g, '').trim();
    assert.equal(text, '');
  });

  it('every id the script looks up exists in index.html, so the window never dies blank at load', () => {
    const script = readFileSync(path.join(RENDERER, 'main-window', 'main-window.ts'), 'utf8');
    const ids = new Set([...html.matchAll(/\sid="([\w-]+)"/g)].map((m) => m[1]));
    const wanted = [
      ...[...script.matchAll(/(?:byId|svgById)(?:<[^>]+>)?\('([\w-]+)'\)/g)].map((m) => m[1]),
      ...[...script.matchAll(/^\s+\w+: '(f-[\w-]+)',$/gm)].map((m) => m[1]),
    ];
    const fields = [...html.matchAll(/data-field="(\w+)"/g)].map((m) => m[1]);
    assert.ok(wanted.length > 20 && fields.length === 7, 'the patterns still find the lookups');
    for (const id of [...wanted, ...fields.map((f) => `e-${f}`)]) assert.ok(ids.has(id), `#${id} missing from index.html`);
  });

  it('copy-static.mjs puts the window page next to its script, with the Lucide licence (docs/DESIGN.md §11)', () => {
    for (const file of ['index.html', 'main-window.css', 'main-window.js', 'LICENSE-lucide.txt']) {
      assert.ok(existsSync(path.join(DIST_RENDERER, 'main-window', file)), file);
    }
    assert.match(read(path.join('main-window', 'LICENSE-lucide.txt')), /^ISC License/);
  });
});

describe('contrast pairs of §9.4 B (FR-DS-17)', () => {
  const pairs: { fg: string; bg: string; min: number }[] = [
    { fg: '--ts-text', bg: '--ts-bg', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-text', bg: '--ts-surface', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-text-muted', bg: '--ts-bg', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-text-muted', bg: '--ts-surface', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-accent', bg: '--ts-bg', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-accent', bg: '--ts-surface', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-on-accent', bg: '--ts-accent-fill', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-on-secondary', bg: '--ts-secondary-fill', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-error', bg: '--ts-bg', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-error', bg: '--ts-surface', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-notice', bg: '--ts-bg', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-notice', bg: '--ts-surface', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-recording', bg: '--ts-bg', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-recording', bg: '--ts-surface', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-working', bg: '--ts-bg', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-working', bg: '--ts-surface', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-focus', bg: '--ts-bg', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-focus', bg: '--ts-surface', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-border-strong', bg: '--ts-bg', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-border-strong', bg: '--ts-surface', min: GRAPHIC_MIN_CONTRAST },
    // Cards, entries and popups (--ts-card) and the hover fill of the buttons and options on them (--ts-hover).
    { fg: '--ts-text', bg: '--ts-card', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-text-muted', bg: '--ts-card', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-accent', bg: '--ts-card', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-error', bg: '--ts-card', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-notice', bg: '--ts-card', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-focus', bg: '--ts-card', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-border-strong', bg: '--ts-card', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-text', bg: '--ts-hover', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-text-muted', bg: '--ts-hover', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-accent', bg: '--ts-hover', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-error', bg: '--ts-hover', min: TEXT_MIN_CONTRAST },
    // The main window's destructive button: its text on the error fill (docs/DESIGN.md §6.5).
    { fg: '--ts-on-accent', bg: '--ts-error', min: TEXT_MIN_CONTRAST },
    // The pill: text, timer, hint, error and notice are text; dot, bars and dots are graphics.
    { fg: '--ts-text', bg: '--ts-pill-surface', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-text-muted', bg: '--ts-pill-surface', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-error', bg: '--ts-pill-surface', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-notice', bg: '--ts-pill-surface', min: TEXT_MIN_CONTRAST },
    { fg: '--ts-recording', bg: '--ts-pill-surface', min: GRAPHIC_MIN_CONTRAST },
    { fg: '--ts-working', bg: '--ts-pill-surface', min: GRAPHIC_MIN_CONTRAST },
  ];

  for (const theme of THEMES) {
    for (const { fg, bg, min } of pairs) {
      it(`${theme}: ${fg} on ${bg} ≥ ${min}:1`, () => {
        const ratio = contrastRatio(hexOf(fg, theme), hexOf(bg, theme));
        assert.ok(ratio >= min, `${ratio.toFixed(2)}:1 is below ${min}:1`);
      });
    }
  }

  it('recording and error never share a colour (FR-DS-08)', () => {
    for (const theme of THEMES) assert.notEqual(hexOf('--ts-recording', theme), hexOf('--ts-error', theme));
  });
});

describe('contrastRatio (WCAG 2.x)', () => {
  it('matches the reference values', () => {
    assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
    assert.equal(contrastRatio('#7AA05A', '#7AA05A'), 1);
    // Palette as it came, spec §9.4 A.
    assert.equal(contrastRatio(PALETTE.blackHole, PALETTE.alabaster).toFixed(2), '14.11');
    assert.equal(contrastRatio(PALETTE.alabaster, PALETTE.blackHole).toFixed(2), '14.11');
    assert.equal(contrastRatio(PALETTE.slateGreen, PALETTE.blackHole).toFixed(2), '2.03');
    assert.equal(contrastRatio(PALETTE.mossGreen, '#FFFFFF').toFixed(4), '2.9985');
  });
});

describe('shared/palette.ts mirrors tokens.css (RISK-novo-1)', () => {
  it('the palette primitives are the same', () => {
    const primitives = [...light.keys()].filter((t) => t.startsWith('--ts-palette-'));
    assert.deepEqual(primitives.sort(), Object.values(PRIMITIVE_TOKEN).sort());
    for (const [key, token] of Object.entries(PRIMITIVE_TOKEN) as [keyof typeof PALETTE, string][]) {
      assert.equal(PALETTE[key].toLowerCase(), light.get(token)?.toLowerCase(), token);
    }
  });

  it('the main window frame is the page background of each theme', () => {
    assert.equal(DERIVED.bgLight.toLowerCase(), hexOf('--ts-bg', 'light'));
    assert.equal(PALETTE.blackHole.toLowerCase(), hexOf('--ts-bg', 'dark'));
  });

  it('the tray colours are the brand accent, Apricot and the neutral token (D5, D12)', () => {
    assert.equal(TRAY_COLORS.dark.glyph.toLowerCase(), hexOf('--ts-accent', 'dark'));
    assert.equal(TRAY_COLORS.light.glyph.toLowerCase(), hexOf('--ts-accent', 'light'));
    assert.equal(DERIVED.tealLight.toLowerCase(), hexOf('--ts-accent', 'light'));
    assert.equal(DERIVED.neutral.toLowerCase(), hexOf('--ts-border-strong', 'light'));
    assert.equal(DERIVED.neutral.toLowerCase(), hexOf('--ts-border-strong', 'dark'));
    assert.equal(TRAY_COLORS.dark.dot, PALETTE.apricot);
    assert.equal(TRAY_COLORS.light.dot, DERIVED.apricotDark);
  });

  it('the brand teal is the logo colour and the dark-theme accent and recording (D12)', () => {
    const logo = readFileSync(path.join(SRC, '..', '..', 'docs', 'assets', 'logo.svg'), 'utf8');
    assert.match(logo, new RegExp(`fill="${PALETTE.teal}"`));
    assert.equal(hexOf('--ts-accent', 'dark'), PALETTE.teal.toLowerCase());
    assert.equal(hexOf('--ts-recording', 'dark'), PALETTE.teal.toLowerCase());
    assert.equal(hexOf('--ts-accent', 'light'), '#0d7a72');
    assert.equal(hexOf('--ts-recording', 'light'), '#0f8a81');
  });
});
