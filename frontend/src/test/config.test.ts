import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CONFIG, defaultConfig, normalizeConfig, withRetention } from '../main/config';
import { HOTKEY_CODES, type HotkeyName, hotkeysFor, isHotkeyName } from '../main/keys';
import { validateSettings } from '../main/settings';

describe('normalizeConfig (FR-DICT-13)', () => {
  it('missing file content falls back to defaults', () => {
    const warnings: string[] = [];
    assert.deepEqual(normalizeConfig(null, (f) => warnings.push(f)), DEFAULT_CONFIG);
    assert.deepEqual(warnings, ['root']);
  });

  it('accepts valid overrides', () => {
    const config = normalizeConfig(
      { hotkey: 'RightAlt', holdThresholdMs: 400, sounds: false, pill: { position: 'top-center' } },
      () => assert.fail('unexpected warning'),
    );
    assert.equal(config.hotkey, 'RightAlt');
    assert.equal(config.holdThresholdMs, 400);
    assert.equal(config.sounds, false);
    assert.equal(config.pill.position, 'top-center');
  });

  it('replaces invalid fields with defaults and reports them', () => {
    const warnings: string[] = [];
    const config = normalizeConfig(
      { hotkey: 'LeftCtrl', maxRecordingMs: 3_600_000, language: 'portuguese', transcription: { model: 'gpt-x' } },
      (f) => warnings.push(f),
    );
    assert.equal(config.hotkey, DEFAULT_CONFIG.hotkey);
    assert.equal(config.maxRecordingMs, DEFAULT_CONFIG.maxRecordingMs);
    assert.equal(config.language, 'pt');
    assert.equal(config.transcription.model, DEFAULT_CONFIG.transcription.model);
    assert.deepEqual(warnings.sort(), ['hotkey', 'language', 'maxRecordingMs', 'transcription']);
  });
});

// TEST-004, extended — spec distribuicao-windows-macos FR-MAC-11, crit. 29 (D5).
describe('hotkey per system (FR-MAC-11)', () => {
  it('the default is Right Ctrl on Windows and Right Command on macOS; nothing else differs', () => {
    assert.equal(defaultConfig('win32').hotkey, 'RightCtrl');
    assert.equal(defaultConfig('darwin').hotkey, 'RightMeta');
    assert.deepEqual({ ...defaultConfig('darwin'), hotkey: 'RightCtrl' }, defaultConfig('win32'));
    assert.deepEqual(DEFAULT_CONFIG, defaultConfig(process.platform));
  });

  it('RightMeta is valid only on macOS; on Windows it falls back to Right Ctrl with config_invalid_field', () => {
    const onMac: string[] = [];
    assert.equal(normalizeConfig({ hotkey: 'RightMeta' }, (f) => onMac.push(f), 'darwin').hotkey, 'RightMeta');
    assert.deepEqual(onMac, []);
    const onWin: string[] = [];
    assert.equal(normalizeConfig({ hotkey: 'RightMeta' }, (f) => onWin.push(f), 'win32').hotkey, 'RightCtrl');
    assert.deepEqual(onWin, ['hotkey']);
  });

  it('a config.json from Windows stays valid on macOS (and the other way round)', () => {
    for (const platform of ['win32', 'darwin'] as const) {
      const config = normalizeConfig({ hotkey: 'RightAlt', holdThresholdMs: 600 }, () => assert.fail('warned'), platform);
      assert.equal(config.hotkey, 'RightAlt');
      assert.equal(config.holdThresholdMs, 600);
    }
    assert.equal(normalizeConfig(null, () => {}, 'darwin').hotkey, 'RightMeta');
  });

  it('the list on screen has Right Command only on macOS', () => {
    assert.ok(hotkeysFor('darwin').includes('RightMeta'));
    assert.ok(!hotkeysFor('win32').includes('RightMeta'));
    assert.deepEqual(hotkeysFor('win32'), (Object.keys(HOTKEY_CODES) as HotkeyName[]).filter((k) => k !== 'RightMeta'));
    assert.equal(HOTKEY_CODES.RightMeta, 3676);
    assert.equal(isHotkeyName('RightMeta', 'win32'), false);
    assert.equal(isHotkeyName('RightMeta', 'darwin'), true);
    assert.equal(isHotkeyName('LeftCtrl', 'darwin'), false);
  });

  it('the screen validation follows the same rule (FR-UI-28)', () => {
    const input = { hotkey: 'RightMeta', holdThresholdMs: 500, maxRecordingMs: 300_000, language: 'pt', model: 'whisper-large-v3-turbo', pillPosition: 'bottom-center', sounds: true };
    assert.equal(validateSettings(input, 'darwin').ok, true);
    assert.deepEqual(validateSettings(input, 'win32'), { ok: false, field: 'hotkey' });
  });
});

// TEST-004, extended — spec historico §9 and historico-dados-v1 (FR-HIST-30, FR-HIST-31).
describe('config.json history.retentionDays (historico-dados-v1)', () => {
  const read = (raw: unknown) => {
    const warnings: string[] = [];
    return { value: normalizeConfig(raw, (f) => warnings.push(f)).history.retentionDays, warnings };
  };

  it('defaults to 30 days, and version stays 1', () => {
    assert.deepEqual(DEFAULT_CONFIG.history, { retentionDays: 30 });
    assert.equal(DEFAULT_CONFIG.version, 1);
  });

  it('a config.json without the field (format of before) means 30 days, with no warning', () => {
    assert.deepEqual(read({ hotkey: 'RightCtrl' }), { value: 30, warnings: [] });
    assert.deepEqual(read({ history: {} }), { value: 30, warnings: [] });
  });

  it('accepts 0 ("nunca guardar"), 1 to 3650 and null ("para sempre")', () => {
    for (const v of [0, 1, 7, 3650, null]) assert.deepEqual(read({ history: { retentionDays: v } }), { value: v, warnings: [] });
  });

  it('an invalid value falls back to 30 with config_invalid_field "history" (BR-012)', () => {
    for (const history of [{ retentionDays: 5000 }, { retentionDays: -1 }, { retentionDays: 7.5 }, { retentionDays: '30' }, null, 30, []]) {
      assert.deepEqual(read({ history }), { value: 30, warnings: ['history'] }, JSON.stringify(history));
    }
  });

  it('an unknown key inside history is ignored without a warning', () => {
    assert.deepEqual(read({ history: { retentionDays: 7, later: true } }), { value: 7, warnings: [] });
  });

  it('withRetention changes only history.retentionDays: version, unknown fields and other history keys stay', () => {
    const raw = { version: 1, hotkey: 'F13', x: { y: 1 }, history: { retentionDays: 30, later: 'z' } };
    assert.deepEqual(withRetention(raw, null), { version: 1, hotkey: 'F13', x: { y: 1 }, history: { retentionDays: null, later: 'z' } });
    assert.deepEqual(withRetention({ version: 1 }, 7), { version: 1, history: { retentionDays: 7 } });
    assert.deepEqual(withRetention({ history: 'broken' }, 0), { history: { retentionDays: 0 } });
    assert.deepEqual(raw.history, { retentionDays: 30, later: 'z' }, 'the input is not mutated');
  });
});
