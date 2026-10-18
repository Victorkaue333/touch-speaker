import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { HOTKEY_CODES } from '../main/keys';
import { LoginItem, type LoginItemApp, type LoginItemSystemState } from '../main/login-item';
import {
  asGroqKeyInput,
  asLoginItemInput,
  asSettingsInput,
  isEmptyPayload,
  isMainWindowSender,
  isPageUrl,
} from '../main/main-window-ipc';
import { errorMessage, errorMessagesFor, hotkeyNames, hotkeyNamesFor, mainWindowStrings } from '../main/strings';
import { Channel, EDITABLE_SETTINGS_KEYS } from '../shared/ipc';

// TEST-009 — spec docs/spec/features/janela-principal.md §10 and §14 (FR-UI-10, FR-UI-25, FR-UI-33,
// FR-UI-36, FR-UI-37), RISK-027 (the contract written in two places).

const SETTINGS = {
  hotkey: 'RightCtrl',
  holdThresholdMs: 500,
  maxRecordingMs: 300_000,
  language: 'pt',
  model: 'whisper-large-v3-turbo',
  pillPosition: 'bottom-center',
  sounds: true,
};

describe('asGroqKeyInput (FR-UI-19, FR-UI-33)', () => {
  it('drops anything but exactly { key: string }', () => {
    for (const args of [
      [],
      ['gsk_x'],
      [{ key: 42 }],
      [{}],
      [{ key: 'gsk_x', extra: 1 }],
      [{ key: 'gsk_x' }, 2],
      [['gsk_x']],
      [null],
      [Object.create({ key: 'gsk_x' })],
    ]) {
      assert.deepEqual(asGroqKeyInput(args), { kind: 'rejected' }, JSON.stringify(args));
    }
  });

  it('empty, inner space, control character or more than 512 characters is invalid_format', () => {
    for (const key of ['', '   ', ' abc def ', 'abc\u0001', 'x'.repeat(513)]) {
      assert.deepEqual(asGroqKeyInput([{ key }]), { kind: 'invalid_format' });
    }
  });

  it('trims the ends of a valid key', () => {
    assert.deepEqual(asGroqKeyInput([{ key: '  gsk_example  ' }]), { kind: 'ok', key: 'gsk_example' });
    const bare: Record<string, unknown> = Object.create(null);
    bare.key = 'gsk_example';
    assert.deepEqual(asGroqKeyInput([bare]), { kind: 'ok', key: 'gsk_example' });
  });
});

describe('asSettingsInput (FR-UI-33, §10)', () => {
  it('accepts exactly the seven fields with their types; ranges are checked later', () => {
    assert.deepEqual(asSettingsInput([SETTINGS]), SETTINGS);
    assert.deepEqual(asSettingsInput([{ ...SETTINGS, holdThresholdMs: 100 }]), { ...SETTINGS, holdThresholdMs: 100 });
  });

  it('a key more or less, the retention, a wrong type or a huge string is dropped', () => {
    const { sounds: _sounds, ...missing } = SETTINGS;
    for (const payload of [
      missing,
      { ...SETTINGS, extra: 1 },
      { ...SETTINGS, retentionDays: 30 },
      { ...SETTINGS, history: { retentionDays: 30 } },
      { ...SETTINGS, holdThresholdMs: '500' },
      { ...SETTINGS, sounds: 'true' },
      { ...SETTINGS, hotkey: 3613 },
      { ...SETTINGS, language: 'p'.repeat(65) },
      [SETTINGS],
      null,
    ]) {
      assert.equal(asSettingsInput([payload]), null, JSON.stringify(payload));
    }
    assert.equal(asSettingsInput([]), null);
    assert.equal(asSettingsInput([SETTINGS, SETTINGS]), null);
  });

  it('the seven keys are the ones of the contract', () => {
    assert.deepEqual([...EDITABLE_SETTINGS_KEYS].sort(), Object.keys(SETTINGS).sort());
  });
});

describe('asLoginItemInput and empty payloads', () => {
  it('login-item:set takes only { enabled: boolean }', () => {
    assert.deepEqual(asLoginItemInput([{ enabled: true }]), { enabled: true });
    assert.deepEqual(asLoginItemInput([{ enabled: false }]), { enabled: false });
    for (const args of [[], [{ enabled: 'yes' }], [{ enabled: true, extra: 1 }], [true], [{ enabled: true }, 1]]) {
      assert.equal(asLoginItemInput(args), null, JSON.stringify(args));
    }
  });

  it('channels without payload accept no argument', () => {
    assert.equal(isEmptyPayload([]), true);
    assert.equal(isEmptyPayload([undefined]), false);
    assert.equal(isEmptyPayload([{}]), false);
  });
});

describe('sender of the main window (FR-UI-33)', () => {
  const pageFile = path.resolve('dist', 'renderer', 'main-window', 'index.html');
  const pageUrl = pathToFileURL(pageFile).href;
  const windowContents = { id: 'main window' };
  const pillContents = { id: 'pill' };
  const top = (url: string) => ({ url, isTop: true });

  it('accepts the top frame of the window open now, showing index.html', () => {
    assert.equal(isMainWindowSender(windowContents, top(pageUrl), windowContents, pageFile), true);
    assert.equal(isMainWindowSender(windowContents, top(`${pageUrl}#settings`), windowContents, pageFile), true);
  });

  it('refuses the pill, a closed window, an iframe, a missing frame or another page', () => {
    assert.equal(isMainWindowSender(pillContents, top(pageUrl), windowContents, pageFile), false);
    assert.equal(isMainWindowSender(windowContents, top(pageUrl), null, pageFile), false);
    assert.equal(isMainWindowSender(windowContents, { url: pageUrl, isTop: false }, windowContents, pageFile), false);
    assert.equal(isMainWindowSender(windowContents, null, windowContents, pageFile), false);
    const pill = pathToFileURL(path.resolve('dist', 'renderer', 'pill.html')).href;
    assert.equal(isMainWindowSender(windowContents, top(pill), windowContents, pageFile), false);
  });

  it('only file: URLs of that exact page, with no query', () => {
    assert.equal(isPageUrl(`${pageUrl}?x=1`, pageFile), false);
    assert.equal(isPageUrl('https://example.com/index.html', pageFile), false);
    assert.equal(isPageUrl('about:blank', pageFile), false);
    assert.equal(isPageUrl('not a url', pageFile), false);
  });

  it('the path compares case-insensitively on Windows only', () => {
    const upper = pathToFileURL(pageFile.toUpperCase()).href;
    assert.equal(isPageUrl(upper, pageFile, 'win32'), true);
    if (pageFile !== pageFile.toUpperCase()) assert.equal(isPageUrl(upper, pageFile, 'linux'), false);
  });
});

describe('LoginItem (FR-UI-36, FR-UI-37)', () => {
  function fakeApp(isPackaged: boolean, state: LoginItemSystemState, onSet?: (enabled: boolean) => void) {
    const calls: boolean[] = [];
    const app: LoginItemApp = {
      isPackaged,
      getLoginItemSettings: () => ({ ...state }),
      setLoginItemSettings: ({ openAtLogin }) => {
        calls.push(openAtLogin);
        if (onSet) onSet(openAtLogin);
        else {
          state.openAtLogin = openAtLogin;
          state.executableWillLaunchAtLogin = openAtLogin;
        }
      },
    };
    return { app, calls };
  }

  it('unpackaged: unavailable, and the system is never touched (RISK-029)', () => {
    const { app, calls } = fakeApp(false, { openAtLogin: false });
    const item = new LoginItem(app, 'win32');
    assert.deepEqual(item.read(), { available: false, enabled: false });
    assert.deepEqual(item.set(true), { result: { ok: false, code: 'unavailable', enabled: false } });
    assert.deepEqual(calls, []);
  });

  it('packaged: writes now and answers with the state re-read from the system', () => {
    const { app, calls } = fakeApp(true, { openAtLogin: true, executableWillLaunchAtLogin: true });
    const item = new LoginItem(app, 'win32');
    assert.deepEqual(item.read(), { available: true, enabled: true });
    assert.deepEqual(item.set(false), { result: { ok: true, enabled: false } });
    assert.deepEqual(calls, [false]);
    assert.deepEqual(item.read(), { available: true, enabled: false });
  });

  it('on Windows a deactivation in Task Manager counts as off', () => {
    const { app } = fakeApp(true, { openAtLogin: true, executableWillLaunchAtLogin: false });
    assert.deepEqual(new LoginItem(app, 'win32').read(), { available: true, enabled: false });
    assert.deepEqual(new LoginItem(app, 'darwin').read(), { available: true, enabled: true });
  });

  it('a failure answers login_item_failed with the real state', () => {
    const throwing = fakeApp(true, { openAtLogin: false, executableWillLaunchAtLogin: false }, () => {
      throw new Error('registry');
    });
    assert.deepEqual(new LoginItem(throwing.app, 'win32').set(true), {
      result: { ok: false, code: 'login_item_failed', enabled: false },
      name: 'Error',
    });
    const ignored = fakeApp(true, { openAtLogin: false, executableWillLaunchAtLogin: false }, () => {});
    assert.deepEqual(new LoginItem(ignored.app, 'win32').set(true), {
      result: { ok: false, code: 'login_item_failed', enabled: false },
      name: 'not_applied',
    });
  });
});

describe('contract and texts of the main window (FR-UI-10, FR-UI-25, RISK-027)', () => {
  const preloadSource = (name: string) => readFileSync(path.join(__dirname, '..', '..', 'src', 'preload', name), 'utf8');
  const channelsIn = (source: string) => [...source.matchAll(/'([a-z-]+:[a-z-]+)'/g)].map((m) => m[1]).sort();

  it('the preload of the window uses exactly the window channels of shared/ipc.ts', () => {
    const windowChannels = Object.values(Channel).filter((c) => !c.startsWith('recorder:') && !c.startsWith('pill:'));
    assert.deepEqual(channelsIn(preloadSource('main-window.ts')), [...windowChannels].sort());
  });

  it("the pill's preload exposes nothing of the window", () => {
    for (const channel of channelsIn(preloadSource('pill.ts'))) {
      assert.ok(channel?.startsWith('recorder:') || channel?.startsWith('pill:'), channel);
    }
  });

  it('every text of the window is a non-empty string, cloneable over IPC', () => {
    const texts = mainWindowStrings('win32');
    assert.deepEqual(structuredClone(texts), texts);
    const walk = (value: unknown, where: string): void => {
      if (typeof value === 'string') assert.ok(value.length > 0, `${where} is empty`);
      else if (typeof value === 'object' && value !== null) for (const [k, v] of Object.entries(value)) walk(v, `${where}.${k}`);
      else assert.fail(`${where} is not a string`);
    };
    walk(texts, 'strings');
    assert.deepEqual(Object.keys(texts.hotkeyNames).sort(), Object.keys(HOTKEY_CODES).sort());
    assert.deepEqual(Object.keys(texts.fieldLabels).sort(), [...EDITABLE_SETTINGS_KEYS].sort());
    assert.equal(hotkeyNamesFor('win32').RightAlt, 'Alt direito');
    assert.deepEqual(hotkeyNames, hotkeyNamesFor(process.platform));
  });

  it('every data-text and data-label of index.html has its text', () => {
    const html = readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'main-window', 'index.html'), 'utf8');
    const texts = mainWindowStrings() as unknown as Record<string, unknown>;
    // Dotted keys reach the nested groups of spec historico ("history.copy", "retention.label", "home.today").
    const at = (key: string): unknown =>
      key.split('.').reduce<unknown>((v, part) => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>)[part] : undefined), texts);
    const keys = [...html.matchAll(/data-text="([\w.]+)"/g)].map((m) => m[1] ?? '');
    assert.ok(keys.length > 30);
    for (const key of keys) assert.equal(typeof at(key), 'string', `data-text="${key}"`);
    assert.ok(keys.some((k) => k.startsWith('history.')) && keys.some((k) => k.startsWith('retention.')));
    const labels = [...html.matchAll(/data-label="(\w+)"/g)].map((m) => m[1]);
    assert.deepEqual([...labels].sort(), [...EDITABLE_SETTINGS_KEYS].sort());
  });

  it('the login item label follows the platform (FR-UI-36)', () => {
    assert.equal(mainWindowStrings('win32').loginItem, 'Iniciar com o Windows');
    assert.equal(mainWindowStrings('darwin').loginItem, 'Abrir ao iniciar sessão');
  });

  it('the pill points to the window, not to the README, when the key is missing (FR-UI-25)', () => {
    assert.equal(errorMessagesFor('win32').no_api_key, 'Falta a chave da Groq — abra o Touch Speaker pela bandeja');
    assert.equal(errorMessagesFor('darwin').no_api_key, 'Falta a chave da Groq — abra o Touch Speaker pela barra de menus');
    assert.equal(errorMessage('no_api_key'), errorMessagesFor(process.platform).no_api_key);
  });
});
