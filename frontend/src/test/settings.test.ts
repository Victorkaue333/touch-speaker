import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { nodeFilePort } from '../main/atomic-file';
import { type AppConfig, ConfigWriter, DEFAULT_CONFIG, loadConfig, readConfigQuietly } from '../main/config';
import {
  changedFields,
  mergeSettings,
  type SettingsInput,
  SettingsStore,
  shouldOpenOnFirstRun,
  toEditable,
  validateSettings,
} from '../main/settings';
import type { EditableSettings } from '../shared/ipc';

// TEST-008 — spec docs/spec/features/janela-principal.md §14 (FR-UI-26…31, FR-UI-35).

const VALID: EditableSettings = {
  hotkey: 'RightAlt',
  holdThresholdMs: 700,
  maxRecordingMs: 120_000,
  language: 'en',
  model: 'whisper-large-v3',
  pillPosition: 'top-center',
  sounds: false,
};

describe('validateSettings — the rules of normalizeConfig (FR-UI-28)', () => {
  it('accepts valid values as they are', () => {
    assert.deepEqual(validateSettings(VALID), { ok: true, values: VALID });
  });

  const cases: [keyof EditableSettings, Partial<SettingsInput>][] = [
    ['hotkey', { hotkey: 'LeftCtrl' }],
    ['holdThresholdMs', { holdThresholdMs: 100 }],
    ['holdThresholdMs', { holdThresholdMs: 9999 }],
    ['holdThresholdMs', { holdThresholdMs: 500.5 }],
    ['holdThresholdMs', { holdThresholdMs: Number.NaN }],
    ['maxRecordingMs', { maxRecordingMs: 9_999 }],
    ['maxRecordingMs', { maxRecordingMs: 300_001 }],
    ['language', { language: 'PT' }],
    ['language', { language: 'por' }],
    ['language', { language: '' }],
    ['model', { model: 'gpt-x' }],
    ['pillPosition', { pillPosition: 'left' }],
  ];
  for (const [field, change] of cases) {
    it(`${JSON.stringify(change)} is invalid_field "${field}"`, () => {
      assert.deepEqual(validateSettings({ ...VALID, ...change }), { ok: false, field });
    });
  }

  it('the limits themselves are valid: 200 and 1500 ms to hold, 10 s and 5 min of recording', () => {
    for (const change of [{ holdThresholdMs: 200 }, { holdThresholdMs: 1500 }, { maxRecordingMs: 10_000 }, { maxRecordingMs: 300_000 }]) {
      assert.equal(validateSettings({ ...VALID, ...change }).ok, true, JSON.stringify(change));
    }
  });
});

describe('mergeSettings (FR-UI-29)', () => {
  it('changes only the seven fields and keeps everything else', () => {
    const raw = {
      version: 1,
      hotkey: 'RightCtrl',
      transcription: { provider: 'groq', model: 'whisper-large-v3-turbo', extra: true },
      microphoneDeviceId: 'device-123',
      pill: { position: 'bottom-center', other: 1 },
      history: { retentionDays: 7 },
      x: 1,
    };
    assert.deepEqual(mergeSettings(raw, VALID), {
      version: 1,
      hotkey: 'RightAlt',
      holdThresholdMs: 700,
      maxRecordingMs: 120_000,
      language: 'en',
      transcription: { provider: 'groq', model: 'whisper-large-v3', extra: true },
      microphoneDeviceId: 'device-123',
      pill: { position: 'top-center', other: 1 },
      sounds: false,
      history: { retentionDays: 7 },
      x: 1,
    });
  });
});

describe('shouldOpenOnFirstRun (FR-UI-35)', () => {
  it('only with config.json created now and no stored key', () => {
    assert.equal(shouldOpenOnFirstRun(true, 'none'), true);
    assert.equal(shouldOpenOnFirstRun(true, 'env'), true);
    assert.equal(shouldOpenOnFirstRun(true, 'unreadable'), true);
    assert.equal(shouldOpenOnFirstRun(true, 'stored'), false);
    for (const state of ['none', 'env', 'unreadable', 'stored'] as const) assert.equal(shouldOpenOnFirstRun(false, state), false);
  });
});

describe('SettingsStore and the config.json queue (FR-UI-26…31)', () => {
  let dir: string;
  const file = () => path.join(dir, 'config.json');
  const readJson = () => JSON.parse(fs.readFileSync(file(), 'utf8')) as Record<string, unknown>;
  const write = (value: unknown) => fs.writeFileSync(file(), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  const inUse = (): AppConfig => structuredClone(DEFAULT_CONFIG);
  const store = (writer = new ConfigWriter(dir), config = inUse()) => new SettingsStore({ dir, inUse: config, writer });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-settings-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loadConfig tells whether it created config.json now', () => {
    assert.equal(loadConfig(dir, () => {}).created, true);
    assert.equal(loadConfig(dir, () => {}).created, false);
  });

  it('reads the disk normalized, without warning (FR-UI-26)', () => {
    write({ ...DEFAULT_CONFIG, holdThresholdMs: 9999, hotkey: 'F13' });
    const read = store().read();
    assert.equal(read.values.holdThresholdMs, 500);
    assert.equal(read.values.hotkey, 'F13');
    assert.equal(readConfigQuietly(dir).holdThresholdMs, 500);
  });

  it('restartPending only when the disk differs from what is in use (FR-UI-31)', async () => {
    write(DEFAULT_CONFIG);
    const s = store();
    assert.equal(s.read().restartPending, false);
    const saved = await s.save({ ...toEditable(inUse()), hotkey: 'RightAlt' });
    assert.deepEqual(saved.result, { ok: true, restartPending: true });
    assert.equal(s.read().restartPending, true);
    const back = await s.save(toEditable(inUse()));
    assert.deepEqual(back.result, { ok: true, restartPending: false });
    assert.equal(s.read().restartPending, false);
  });

  it('keeps unknown fields, microphoneDeviceId, history.retentionDays and version (crit. 29)', async () => {
    write({ ...DEFAULT_CONFIG, microphoneDeviceId: 'device-123', history: { retentionDays: null }, x: 1 });
    const outcome = await store().save(VALID);
    assert.equal(outcome.kind, 'saved');
    assert.deepEqual(outcome.kind === 'saved' ? outcome.fields.sort() : [], [...Object.keys(VALID)].sort());
    const json = readJson();
    assert.equal(json.version, 1);
    assert.equal(json.microphoneDeviceId, 'device-123');
    assert.deepEqual(json.history, { retentionDays: null });
    assert.equal(json.x, 1);
    assert.equal(json.hotkey, 'RightAlt');
    assert.deepEqual(json.transcription, { provider: 'groq', model: 'whisper-large-v3' });
    assert.deepEqual(json.pill, { position: 'top-center' });
    assert.ok(!fs.existsSync(`${file()}.tmp`));
  });

  it('maxRecordingMs travels and is stored in ms (the screen converts to seconds)', async () => {
    write(DEFAULT_CONFIG);
    const s = store();
    await s.save({ ...VALID, maxRecordingMs: 15_000 });
    assert.equal(readJson().maxRecordingMs, 15_000);
    assert.equal(s.read().values.maxRecordingMs, 15_000);
  });

  it('an invalid field refuses the whole save and writes nothing (FR-UI-28, crit. 28)', async () => {
    write(DEFAULT_CONFIG);
    const before = fs.readFileSync(file(), 'utf8');
    const outcome = await store().save({ ...VALID, holdThresholdMs: 100 });
    assert.deepEqual(outcome, {
      kind: 'invalid_field',
      result: { ok: false, code: 'invalid_field', field: 'holdThresholdMs' },
      field: 'holdThresholdMs',
    });
    assert.equal(fs.readFileSync(file(), 'utf8'), before);
  });

  it('only the changed fields are reported for the log', async () => {
    write(DEFAULT_CONFIG);
    const outcome = await store().save({ ...toEditable(inUse()), sounds: false, language: 'es' });
    assert.deepEqual(outcome.kind === 'saved' ? outcome.fields : null, ['language', 'sounds']);
    assert.deepEqual(changedFields(VALID, VALID), []);
  });

  it('a failed write keeps the previous file (FR-UI-30)', async () => {
    write(DEFAULT_CONFIG);
    const before = fs.readFileSync(file(), 'utf8');
    const writer = new ConfigWriter(dir, {
      ...nodeFilePort,
      renameSync: () => {
        throw Object.assign(new Error('read only'), { code: 'EPERM' });
      },
    });
    const outcome = await store(writer).save(VALID);
    assert.deepEqual(outcome, { kind: 'write_failed', result: { ok: false, code: 'write_failed' }, name: 'EPERM' });
    assert.equal(fs.readFileSync(file(), 'utf8'), before);
    assert.ok(!fs.existsSync(`${file()}.tmp`));
  });

  it('a config.json that is not a JSON object is never overwritten', async () => {
    write('{ not json');
    const outcome = await store().save(VALID);
    assert.equal(outcome.kind, 'write_failed');
    assert.equal(fs.readFileSync(file(), 'utf8'), '{ not json');
  });

  it('a deleted config.json is recreated with the defaults and the values of the screen', async () => {
    const outcome = await store().save(VALID);
    assert.equal(outcome.kind, 'saved');
    const json = readJson();
    assert.equal(json.version, 1);
    assert.equal(json.hotkey, 'RightAlt');
    assert.equal(json.microphoneDeviceId, null);
  });

  it('preferences and the history retention through the same queue keep both changes (FR-UI-29)', async () => {
    write(DEFAULT_CONFIG);
    const writer = new ConfigWriter(dir);
    // The retention write itself belongs to spec historico; here, any other writer of the same queue.
    const retention = writer.update((raw) => ({ ...raw, history: { retentionDays: null } }));
    const preferences = store(writer).save(VALID);
    const [r, p] = await Promise.all([retention, preferences]);
    assert.deepEqual(r, { ok: true });
    assert.equal(p.kind, 'saved');
    const json = readJson();
    assert.deepEqual(json.history, { retentionDays: null });
    assert.equal(json.hotkey, 'RightAlt');
  });
});
