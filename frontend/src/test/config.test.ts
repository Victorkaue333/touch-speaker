import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CONFIG, normalizeConfig } from '../main/config';

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
