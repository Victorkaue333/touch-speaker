import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isRetentionDays, MAX_RETENTION_DAYS, retentionCutoff } from '../main/history/retention';

// TEST-010 — spec docs/spec/features/historico.md (FR-HIST-06, FR-HIST-07; criterion 8, pure part).

const NOW = Date.parse('2026-10-18T12:00:00.000Z');

describe('retentionCutoff (FR-HIST-07)', () => {
  it('0 = "nunca guardar": everything goes', () => {
    assert.deepEqual(retentionCutoff(0, NOW), { kind: 'all' });
  });

  it('null = "para sempre": nothing goes', () => {
    assert.deepEqual(retentionCutoff(null, NOW), { kind: 'none' });
  });

  it('N days: entries older than N × 24 h go', () => {
    assert.deepEqual(retentionCutoff(30, NOW), { kind: 'before', iso: '2026-09-18T12:00:00.000Z' });
    assert.deepEqual(retentionCutoff(1, NOW), { kind: 'before', iso: '2026-10-17T12:00:00.000Z' });
    assert.deepEqual(retentionCutoff(MAX_RETENTION_DAYS, NOW), { kind: 'before', iso: new Date(NOW - 3650 * 86_400_000).toISOString() });
  });

  it('an entry of 40 days goes and one of 10 days stays with 30 (criterion 8)', () => {
    const cutoff = retentionCutoff(30, NOW);
    assert.equal(cutoff.kind, 'before');
    const iso = cutoff.kind === 'before' ? cutoff.iso : '';
    assert.ok(new Date(NOW - 40 * 86_400_000).toISOString() < iso);
    assert.ok(new Date(NOW - 10 * 86_400_000).toISOString() > iso);
  });
});

describe('isRetentionDays (config.json and history:set-retention)', () => {
  it('accepts 0, 1 to 3650 and null', () => {
    for (const v of [0, 1, 30, 3650, null]) assert.equal(isRetentionDays(v), true, String(v));
  });

  it('refuses anything else', () => {
    for (const v of [-1, 3651, 5000, 1.5, Number.NaN, '30', undefined, {}, true]) assert.equal(isRetentionDays(v), false, String(v));
  });
});
