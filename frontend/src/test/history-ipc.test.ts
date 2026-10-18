import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asHistoryClearInput,
  asHistoryIdInput,
  asHistoryListInput,
  asRetentionInput,
  decodeCursor,
  encodeCursor,
} from '../main/history/ipc';
import { isEmptyPayload } from '../main/main-window-ipc';

// TEST-013 — spec docs/spec/features/historico.md §10 (FR-HIST-19; criterion 19). The sender check of these
// channels is the main window's, covered by TEST-009 (isMainWindowSender).

const ID = '3f2c9a4e-8b1d-4c6e-9a2b-7d5e1f0c3b8a';
const AT = '2026-10-18T14:32:05.123Z';

describe('history:list payload (FR-HIST-19)', () => {
  it('accepts {} and the three optional keys, with the defaults of §10', () => {
    assert.deepEqual(asHistoryListInput([{}]), { query: '', after: null, limit: 50 });
    assert.deepEqual(asHistoryListInput([{ query: '  deploy  ', cursor: null, limit: 3 }]), { query: 'deploy', after: null, limit: 3 });
    assert.deepEqual(asHistoryListInput([{ cursor: encodeCursor({ createdAt: AT, id: ID }) }]), {
      query: '',
      after: { createdAt: AT, id: ID },
      limit: 50,
    });
  });

  it('a query of 200 characters after trim passes; 201 does not', () => {
    assert.equal(asHistoryListInput([{ query: ` ${'a'.repeat(200)} ` }])?.query.length, 200);
    assert.equal(asHistoryListInput([{ query: 'a'.repeat(201) }]), null);
  });

  it('refuses limit 1000 (criterion 19), 0, 101, 1.5 or a string', () => {
    for (const limit of [1000, 0, 101, 1.5, '50', null]) assert.equal(asHistoryListInput([{ limit }]), null, String(limit));
    assert.equal(asHistoryListInput([{ limit: 100 }])?.limit, 100);
  });

  it('refuses a cursor main did not produce', () => {
    for (const cursor of ['abc', `${AT}~not-a-uuid`, `2026-10-18~${ID}`, `${AT}${ID}`, 'x'.repeat(129), 42]) {
      assert.equal(asHistoryListInput([{ cursor }]), null, String(cursor));
    }
  });

  it('refuses extra keys, no payload, two arguments, arrays and non-plain objects', () => {
    for (const args of [[], [{ query: 'a', extra: 1 }], [{}, 2], [['a']], [null], ['deploy'], [Object.create({ query: 'a' })]]) {
      assert.equal(asHistoryListInput(args), null, JSON.stringify(args));
    }
  });
});

describe('cursor', () => {
  it('round-trips', () => {
    const position = { createdAt: AT, id: ID };
    assert.deepEqual(decodeCursor(encodeCursor(position)), position);
    assert.ok(encodeCursor(position).length <= 128);
  });
});

describe('history:copy and history:delete payload', () => {
  it('accepts exactly { id } with a UUID v4', () => {
    assert.equal(asHistoryIdInput([{ id: ID }]), ID);
  });

  it('refuses an id that is not a UUID v4 (criterion 19), extra keys and other shapes', () => {
    for (const args of [
      [{ id: 'abc' }],
      [{ id: ID.toUpperCase() }],
      [{ id: '3f2c9a4e-8b1d-1c6e-9a2b-7d5e1f0c3b8a' }], // version 1
      [{ id: ID, extra: true }],
      [{ ID }],
      [ID],
      [],
      [{ id: ID }, 1],
    ]) {
      assert.equal(asHistoryIdInput(args), null, JSON.stringify(args));
    }
  });
});

describe('history:clear payload', () => {
  it('only { confirmed: true } — the second lock', () => {
    assert.equal(asHistoryClearInput([{ confirmed: true }]), true);
    for (const args of [[{ confirmed: 'true' }], [{ confirmed: 1 }], [{}], [], [{ confirmed: true, all: true }], [true]]) {
      assert.equal(asHistoryClearInput(args), false, JSON.stringify(args));
    }
  });
});

describe('history:set-retention payload (FR-HIST-20)', () => {
  it('accepts 0, 1 to 3650 and null', () => {
    for (const retentionDays of [0, 1, 7, 30, 3650, null]) assert.deepEqual(asRetentionInput([{ retentionDays }]), { retentionDays });
  });

  it('refuses 5000 (criterion 19), negatives, fractions, strings, a missing key and extra keys', () => {
    for (const args of [
      [{ retentionDays: 5000 }],
      [{ retentionDays: -1 }],
      [{ retentionDays: 7.5 }],
      [{ retentionDays: '30' }],
      [{ retentionDays: undefined }],
      [{}],
      [{ retentionDays: 30, hotkey: 'F13' }],
      [30],
      [],
    ]) {
      assert.equal(asRetentionInput(args), null, JSON.stringify(args));
    }
  });
});

describe('history:get-retention and history:stats', () => {
  it('take no argument at all', () => {
    assert.equal(isEmptyPayload([]), true);
    assert.equal(isEmptyPayload([{}]), false);
  });
});
