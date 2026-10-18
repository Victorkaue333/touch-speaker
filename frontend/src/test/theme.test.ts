import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { readFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ConfigWriter, DEFAULT_CONFIG, normalizeConfig, withRetention, withTheme } from '../main/config';
import { asThemeInput } from '../main/main-window-ipc';
import { mainWindowStrings } from '../main/strings';
import { ThemeSetting } from '../main/theme-setting';
import { isThemePreference, nextTheme, resolveTheme, type ThemePreference } from '../shared/theme';
import { RecordingLog } from './history-fakes';
import { rendererFunction } from './renderer-source';

// TEST-018 — spec docs/spec/features/janela-principal.md FR-UI-39…42 (manual theme, Victor 18/out/2026;
// design-system D4 revised): config field, theme:set payload, resolution, and the data-theme blocks of
// tokens.css staying equal to the two theme blocks they override.

const RENDERER = path.join(__dirname, '..', '..', 'src', 'renderer');

describe('config.json theme (FR-UI-39)', () => {
  const read = (raw: unknown) => {
    const warnings: string[] = [];
    return { theme: normalizeConfig(raw, (f) => warnings.push(f)).theme, warnings };
  };

  it('defaults to "system"; a file without the field follows the system, with no warning', () => {
    assert.equal(DEFAULT_CONFIG.theme, 'system');
    assert.deepEqual(read({ hotkey: 'RightCtrl' }), { theme: 'system', warnings: [] });
  });

  it('accepts system, light and dark', () => {
    for (const theme of ['system', 'light', 'dark']) assert.deepEqual(read({ theme }), { theme, warnings: [] });
  });

  it('anything else falls back to "system" with config_invalid_field "theme" (BR-012)', () => {
    for (const theme of ['Dark', 'auto', '', null, 1, true, { mode: 'dark' }]) {
      assert.deepEqual(read({ theme }), { theme: 'system', warnings: ['theme'] }, JSON.stringify(theme));
    }
  });

  it('withTheme changes only theme', () => {
    const raw = { version: 1, hotkey: 'F13', history: { retentionDays: null }, extra: 1 };
    assert.deepEqual(withTheme(raw, 'dark'), { ...raw, theme: 'dark' });
    assert.deepEqual(withTheme({ ...raw, theme: 'dark' }, 'system'), { ...raw, theme: 'system' });
  });
});

describe('theme:set payload (FR-UI-40)', () => {
  it('accepts exactly { theme } with one of the three values', () => {
    for (const theme of ['system', 'light', 'dark'] as const) assert.deepEqual(asThemeInput([{ theme }]), { theme });
  });

  it('refuses other values, extra keys and other shapes', () => {
    for (const args of [[{ theme: 'auto' }], [{ theme: 'dark', x: 1 }], [{}], ['dark'], [], [{ theme: 'dark' }, 2], [null]]) {
      assert.equal(asThemeInput(args), null, JSON.stringify(args));
    }
  });
});

describe('theme resolution (FR-UI-39, FR-UI-41)', () => {
  it('"system" follows the OS; a choice wins over it', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('dark', false), 'dark');
  });

  it('the toggle flips what is on screen and never goes back to "system"', () => {
    assert.equal(nextTheme('light'), 'dark');
    assert.equal(nextTheme('dark'), 'light');
    assert.equal(nextTheme(resolveTheme('system', true)), 'light');
  });

  it('isThemePreference', () => {
    assert.ok(isThemePreference('system') && isThemePreference('light') && isThemePreference('dark'));
    assert.ok(!isThemePreference('auto') && !isThemePreference(undefined));
  });

  it('the renderer mirrors resolveTheme (a classic script cannot import it)', () => {
    const script = readFileSync(path.join(RENDERER, 'main-window', 'main-window.ts'), 'utf8');
    assert.match(script, /if \(preference === 'system'\) return systemDark \? 'dark' : 'light';\s+return preference;/);
    assert.match(script, /doc\.startViewTransition\(\(\) => applyTheme\(next\)\)/, 'the DOM changes inside the transition callback');
  });

  it('the toggle labels come from strings.ts', () => {
    const t = mainWindowStrings().theme;
    assert.equal(t.toDark, 'Mudar para tema escuro');
    assert.equal(t.toLight, 'Mudar para tema claro');
    assert.equal(t.followSystem, 'Seguir o sistema');
  });
});

describe('ThemeSetting — persistence and application in main (FR-UI-39, FR-UI-40)', () => {
  let dir = '';
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-theme-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const file = () => path.join(dir, 'config.json');
  const readJson = () => JSON.parse(fs.readFileSync(file(), 'utf8')) as Record<string, unknown>;

  function setting(inUse: ThemePreference, writer = new ConfigWriter(dir)) {
    const applied: ThemePreference[] = [];
    const log = new RecordingLog();
    const theme = new ThemeSetting({ inUse, writer, apply: (t) => applied.push(t), log });
    return { theme, applied, log };
  }

  it('the theme of config.json is applied at startup, before any window (no flash, FR-UI-39)', () => {
    const { theme, applied } = setting('dark');
    assert.deepEqual(applied, ['dark']);
    assert.equal(theme.current(), 'dark');
  });

  it('set writes only `theme` to config.json, then applies it — and survives a restart', async () => {
    fs.writeFileSync(file(), JSON.stringify({ ...DEFAULT_CONFIG, hotkey: 'F13', history: { retentionDays: 7 }, extra: 1 }));
    const { theme, applied, log } = setting('system');
    assert.deepEqual(await theme.set('light'), { ok: true, theme: 'light' });
    assert.deepEqual(applied, ['system', 'light']);
    const json = readJson();
    assert.equal(json.theme, 'light');
    assert.equal(json.hotkey, 'F13');
    assert.deepEqual(json.history, { retentionDays: 7 });
    assert.equal(json.extra, 1);
    assert.equal(json.version, 1);
    assert.deepEqual(log.lines.at(-1), { level: 'info', event: 'theme_changed', fields: { theme: 'light' } });
    // Restart: the next startup reads what was written.
    assert.equal(normalizeConfig(readJson(), () => assert.fail('warned')).theme, 'light');
  });

  it('"Seguir o sistema" writes "system" and hands the OS back the choice (FR-UI-42)', async () => {
    fs.writeFileSync(file(), JSON.stringify({ ...DEFAULT_CONFIG, theme: 'dark' }));
    const { theme, applied } = setting('dark');
    assert.deepEqual(await theme.set('system'), { ok: true, theme: 'system' });
    assert.equal(readJson().theme, 'system');
    assert.deepEqual(applied, ['dark', 'system']);
  });

  it('a failed write keeps the theme in use, does not apply the new one and says so', async () => {
    fs.writeFileSync(file(), '{ not json');
    const { theme, applied, log } = setting('dark');
    assert.deepEqual(await theme.set('light'), { ok: false, code: 'write_failed', theme: 'dark' });
    assert.deepEqual(applied, ['dark']);
    assert.equal(theme.current(), 'dark');
    assert.equal(fs.readFileSync(file(), 'utf8'), '{ not json');
    assert.deepEqual(log.lines.at(-1), { level: 'error', event: 'theme_write_failed', fields: { name: 'invalid_json' } });
  });

  it('fast toggles go through the queue in order; the last one wins on disk and in the app', async () => {
    fs.writeFileSync(file(), JSON.stringify(DEFAULT_CONFIG));
    const { theme, applied } = setting('system');
    const results = await Promise.all([theme.set('dark'), theme.set('light'), theme.set('dark')]);
    assert.deepEqual(results.map((r) => r.theme), ['dark', 'light', 'dark']);
    assert.deepEqual(applied, ['system', 'dark', 'light', 'dark']);
    assert.equal(readJson().theme, 'dark');
  });

  it('the theme and the history retention share the config.json queue without erasing each other', async () => {
    fs.writeFileSync(file(), JSON.stringify(DEFAULT_CONFIG));
    const writer = new ConfigWriter(dir);
    const { theme } = setting('system', writer);
    await Promise.all([theme.set('dark'), writer.update((raw) => withRetention(raw, null))]);
    const json = readJson();
    assert.equal(json.theme, 'dark');
    assert.deepEqual(json.history, { retentionDays: null });
  });
});

describe('main window theme script (FR-UI-41)', () => {
  const script = readFileSync(path.join(RENDERER, 'main-window', 'main-window.ts'), 'utf8');
  const css = readFileSync(path.join(RENDERER, 'main-window', 'main-window.css'), 'utf8');

  it('ignores clicks while a reveal runs, and frees the toggle when it finishes', () => {
    assert.match(script, /if \(themeTransitionRunning\) return;/);
    assert.match(script, /transition\.finished[\s\S]*?themeTransitionRunning = false;/);
  });

  it('turns CSS transitions off while the colours swap, so the reveal is the only animation', () => {
    assert.match(script, /root\.dataset\.themeSwitching = '';/);
    assert.match(css, /:root\[data-theme-switching\] \*,[\s\S]*?transition: none !important;/);
    assert.match(css, /::view-transition-old\(root\),\s*::view-transition-new\(root\)\s*\{\s*animation: none;/);
  });

  it('native controls and scrollbars follow the picked theme (color-scheme on :root[data-theme])', () => {
    assert.match(css, /:root\[data-theme='light'\]\s*\{\s*color-scheme: light;/);
    assert.match(css, /:root\[data-theme='dark'\]\s*\{\s*color-scheme: dark;/);
  });

  it('the saved theme goes on before the window content shows', () => {
    const init = script.slice(script.indexOf('async function init'));
    assert.ok(init.indexOf('setDocumentTheme(currentStatus.theme)') < init.indexOf("byId('app').hidden = false"));
  });
});

describe('sun and moon of the toggle (FR-UI-41)', () => {
  const script = readFileSync(path.join(RENDERER, 'main-window', 'main-window.ts'), 'utf8');
  const html = readFileSync(path.join(RENDERER, 'main-window', 'index.html'), 'utf8');

  /** An <svg> as the DOM has it: no `hidden` property, only attributes. */
  class FakeSvg {
    readonly attributes = new Set<string>();
    toggleAttribute(name: string, force: boolean): boolean {
      if (force) this.attributes.add(name);
      else this.attributes.delete(name);
      return force;
    }
  }

  it('both icons are <svg>, looked up with svgById', () => {
    assert.match(html, /<svg id="theme-icon-sun"/);
    assert.match(html, /<svg id="theme-icon-moon"[^>]*\shidden>/);
    assert.match(script, /const themeIconSun = svgById\('theme-icon-sun'\);/);
    assert.match(script, /const themeIconMoon = svgById\('theme-icon-moon'\);/);
  });

  it('the hidden attribute is toggled: the sun on a light screen, the moon on a dark one', () => {
    let screen: 'light' | 'dark' = 'light';
    const sun = new FakeSvg();
    const moon = new FakeSvg();
    const theme = { toLight: 'L', toDark: 'D', system: 'S', dark: 'Dk', light: 'Lt' };
    const render = rendererFunction<() => void>('renderThemeControls', {
      texts: { theme },
      screenTheme: () => screen,
      themeIconSun: sun,
      themeIconMoon: moon,
      themeToggle: { setAttribute: () => {}, title: '' },
      themeFollowSystem: { disabled: false },
      themePreference: 'system',
      byId: () => ({ textContent: '' }),
    });
    render();
    assert.deepEqual([sun.attributes.has('hidden'), moon.attributes.has('hidden')], [false, true]);
    screen = 'dark';
    render();
    assert.deepEqual([sun.attributes.has('hidden'), moon.attributes.has('hidden')], [true, false]);
  });

  it('`.hidden` on an <svg> cannot come back: no <svg> id goes through byId, which refuses a non-HTML element', () => {
    const svgIds = [...html.matchAll(/<svg\b[^>]*\sid="([\w-]+)"/g)].map((m) => m[1] ?? '');
    assert.ok(svgIds.includes('theme-icon-sun') && svgIds.includes('theme-icon-moon'));
    for (const id of svgIds) {
      assert.doesNotMatch(script, new RegExp(`\\bbyId(?:<[^>]+>)?\\('${id}'\\)`), id);
      assert.match(script, new RegExp(`svgById\\('${id}'\\)`), id);
    }
    // SVGSVGElement has no `hidden` in lib.dom, so `themeIconSun.hidden = …` would not even typecheck.
    assert.doesNotMatch(script, /themeIcon(?:Sun|Moon)\.hidden\b|theme-icon-(?:sun|moon)'\)\.hidden\b/);

    class FakeHtmlElement {}
    class FakeSvgElement {}
    const lookup = (found: unknown) => ({ getElementById: () => found });
    const byId = rendererFunction<(id: string) => unknown>('byId', { document: lookup(new FakeSvgElement()), HTMLElement: FakeHtmlElement });
    assert.throws(() => byId('theme-icon-sun'), /missing #theme-icon-sun/);
    const element = new FakeHtmlElement();
    assert.equal(rendererFunction<(id: string) => unknown>('byId', { document: lookup(element), HTMLElement: FakeHtmlElement })('x'), element);
    const svg = new FakeSvgElement();
    const svgById = rendererFunction<(id: string) => unknown>('svgById', { document: lookup(svg), SVGSVGElement: FakeSvgElement });
    assert.equal(svgById('theme-icon-sun'), svg);
    const notSvg = rendererFunction<(id: string) => unknown>('svgById', { document: lookup(element), SVGSVGElement: FakeSvgElement });
    assert.throws(() => notSvg('x'), /missing svg#x/);
  });
});

describe('transitions held while the colours swap (FR-UI-41, FR-UI-42)', () => {
  const script = readFileSync(path.join(RENDERER, 'main-window', 'main-window.ts'), 'utf8');

  function rig() {
    const frames: (() => void)[] = [];
    const timers = new Map<number, { run: () => void; ms: number }>();
    let nextTimer = 1;
    const dataset: Record<string, string> = {};
    const hold = rendererFunction<(waitForSystem: boolean) => void>(
      'holdTransitions',
      {
        document: { documentElement: { dataset } },
        window: {
          setTimeout: (run: () => void, ms: number) => {
            const id = nextTimer++;
            timers.set(id, { run, ms });
            return id;
          },
          clearTimeout: (id: number | undefined) => {
            if (id !== undefined) timers.delete(id);
          },
        },
        requestAnimationFrame: (run: () => void) => frames.push(run),
        SYSTEM_THEME_WAIT_MS: 300,
      },
      'let themeSwitchToken = 0; let themeSwitchTimer;',
    );
    return {
      hold,
      timers,
      frame: () => {
        for (const run of frames.splice(0)) run();
      },
      fireTimers: () => {
        const due = [...timers.values()];
        timers.clear();
        for (const timer of due) timer.run();
      },
      holding: () => 'themeSwitching' in dataset,
    };
  }

  it('a picked theme: transitions come back two frames later', () => {
    const r = rig();
    r.hold(false);
    assert.ok(r.holding());
    r.frame();
    assert.ok(r.holding(), 'still off after one frame');
    r.frame();
    assert.ok(!r.holding());
  });

  it('"Seguir o sistema": held until prefers-color-scheme changes, then two frames', () => {
    const r = rig();
    r.hold(true);
    r.frame();
    r.frame();
    r.frame();
    assert.ok(r.holding(), 'the colours have not swapped yet: main applies themeSource after theme:set');
    assert.deepEqual([...r.timers.values()].map((t) => t.ms), [300]);
    r.hold(false); // the darkQuery change listener, following the system
    assert.equal(r.timers.size, 0, 'the fallback is cancelled');
    r.frame();
    r.frame();
    assert.ok(!r.holding());
  });

  it('no change comes (the system already shows that theme): released after the 300 ms fallback', () => {
    const r = rig();
    r.hold(true);
    r.fireTimers();
    r.frame();
    assert.ok(r.holding());
    r.frame();
    assert.ok(!r.holding());
  });

  it('a newer hold replaces an older one: an earlier release does not end the wait', () => {
    const r = rig();
    r.hold(false);
    r.hold(true);
    r.frame();
    r.frame();
    assert.ok(r.holding());
  });

  it('"system" waits for the media query; the change listener holds only while following the system', () => {
    assert.match(script, /function setDocumentTheme\(preference: ThemePreference\): void \{[\s\S]*?holdTransitions\(preference === 'system'\);/);
    assert.match(
      script,
      /darkQuery\.addEventListener\('change', \(\) => \{\s*if \(themePreference === 'system'\) holdTransitions\(false\);\s*renderThemeControls\(\);\s*\}\);/,
    );
  });
});

describe('tokens.css data-theme blocks (FR-UI-39; FR-DS-02)', () => {
  const css = readFileSync(path.join(RENDERER, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const props = (body: string) => new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2]?.trim().toLowerCase()]));
  const block = (selector: RegExp) => {
    const match = selector.exec(css);
    assert.ok(match?.[1], `missing ${selector}`);
    return props(match[1]);
  };

  const lightRoots = [...css.matchAll(/(?:^|\n):root\s*\{([^}]*)\}/g)].map((m) => props(m[1] ?? ''));
  const light = new Map(lightRoots.flatMap((m) => [...m]));
  const dark = block(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/);
  const forcedLight = block(/:root\[data-theme='light'\]\s*\{([^}]*)\}/);
  const forcedDark = block(/:root\[data-theme='dark'\]\s*\{([^}]*)\}/);

  it('[data-theme="dark"] repeats the dark block exactly', () => {
    assert.deepEqual([...forcedDark].sort(), [...dark].sort());
  });

  it('[data-theme="light"] repeats the light semantic tokens exactly', () => {
    for (const [name, value] of forcedLight) assert.equal(value, light.get(name), name);
    assert.deepEqual([...forcedLight.keys()].sort(), [...dark.keys()].sort(), 'same semantic tokens as the dark theme');
  });
});
