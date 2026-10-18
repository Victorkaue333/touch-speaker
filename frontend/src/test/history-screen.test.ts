import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import type { HistoryListResult } from '../shared/ipc';
import { rendererFunction } from './renderer-source';

// Histórico screen script (spec docs/spec/features/historico.md §7, §7.1; FR-HIST-18): the reload that keeps the
// amount on screen (page by page, never past MAX_PAGE_SIZE per answer) and the focus after a delete. Code review
// of 18/out/2026; the TEST id is registered by the SDD.

const DIR = path.join(__dirname, '..', '..', 'src', 'renderer', 'main-window');
const script = readFileSync(path.join(DIR, 'main-window.ts'), 'utf8');
const html = readFileSync(path.join(DIR, 'index.html'), 'utf8');

type Page = (cursor: string | null, limit: number) => Promise<HistoryListResult>;
type Collect = (page: Page, wanted: number, current: () => boolean) => Promise<{ last: HistoryListResult; entries: { id: string }[] }>;

const collect = rendererFunction<Collect>('collectHistoryPages', { MAX_PAGE_SIZE: 100 });

/** A history of `total` entries behind history:list, the cursor being the index of the next one. */
function history(total: number, status: HistoryListResult['status'] = 'ok') {
  const calls: { cursor: string | null; limit: number }[] = [];
  const page: Page = async (cursor, limit) => {
    calls.push({ cursor, limit });
    assert.ok(limit >= 1 && limit <= 100, `limit ${limit} would be refused by main (ipc_rejected)`);
    const from = cursor === null ? 0 : Number(cursor);
    const ids = status === 'ok' ? Array.from({ length: Math.max(0, Math.min(limit, total - from)) }, (_, i) => `e${from + i}`) : [];
    const end = from + ids.length;
    return {
      status,
      entries: ids.map((id) => ({ id }) as HistoryListResult['entries'][number]),
      nextCursor: status === 'ok' && end < total ? String(end) : null,
      retentionLabel: '',
      unsavedCount: 0,
      unsavedLabel: null,
    };
  };
  return { page, calls };
}

describe('"keep" reload walks the pages up to the amount on screen (FR-HIST-18)', () => {
  it('150 shown of 230: 100 + 50, and the cursor still points past them', async () => {
    const h = history(230);
    const { last, entries } = await collect(h.page, 150, () => true);
    assert.deepEqual(h.calls, [
      { cursor: null, limit: 100 },
      { cursor: '100', limit: 50 },
    ]);
    assert.equal(entries.length, 150);
    assert.equal(new Set(entries.map((e) => e.id)).size, 150);
    assert.equal(last.nextCursor, '150');
  });

  it('a delete with 150 shown of exactly 150 left: the list keeps 149, not 100', async () => {
    const h = history(149);
    const { last, entries } = await collect(h.page, 150, () => true);
    assert.equal(entries.length, 149);
    assert.equal(last.nextCursor, null, '"Carregar mais" hides');
  });

  it('a first page is one call of the asked size', async () => {
    const h = history(230);
    const { entries } = await collect(h.page, 50, () => true);
    assert.deepEqual(h.calls, [{ cursor: null, limit: 50 }]);
    assert.equal(entries.length, 50);
  });

  it('stops when a newer request took over', async () => {
    const h = history(500);
    await collect(h.page, 400, () => false);
    assert.equal(h.calls.length, 1);
  });

  it('a page that is not ok ends the walk with that answer and no entries', async () => {
    const h = history(230, 'unavailable');
    const { last, entries } = await collect(h.page, 150, () => true);
    assert.deepEqual([last.status, entries.length, h.calls.length], ['unavailable', 0, 1]);
  });

  it('loadHistory uses the walk for "keep" and "fresh", and no longer caps at MAX_PAGE_SIZE', () => {
    assert.match(script, /const wanted = mode === 'keep' \? Math\.max\(PAGE_SIZE, historyShown\) : PAGE_SIZE;/);
    assert.match(script, /await collectHistoryPages\(page, wanted, current\)/);
    assert.doesNotMatch(script, /Math\.min\(MAX_PAGE_SIZE, Math\.max\(PAGE_SIZE, historyShown\)\)/);
  });
});

describe('focus after a delete (spec historico §7; WCAG 2.4.3)', () => {
  const target = rendererFunction<(before: string[], deletedId: string, after: string[]) => string | null>('focusTargetAfterDelete');

  it('the next entry, else the one before, else null (the section title)', () => {
    assert.equal(target(['a', 'b', 'c'], 'b', ['a', 'c']), 'c');
    assert.equal(target(['a', 'b', 'c'], 'a', ['b', 'c']), 'b');
    assert.equal(target(['a', 'b', 'c'], 'c', ['a', 'b']), 'b');
    assert.equal(target(['a'], 'a', []), null);
  });

  it('the entry now in the deleted one\'s place: pulled in from the next page, a new dictation on top, another gone', () => {
    assert.equal(target(['a', 'b', 'c'], 'c', ['a', 'b', 'x']), 'x');
    assert.equal(target(['a', 'b', 'c'], 'b', ['n', 'a', 'c']), 'c');
    assert.equal(target(['a', 'b', 'c', 'd'], 'b', ['a', 'd']), 'd');
    assert.equal(target(['a', 'b', 'c'], 'b', ['a']), 'a');
  });

  it('moves once a list fetched after the answer is drawn, to the delete button or #history-title', () => {
    const del = script.slice(script.indexOf('async function deleteEntry'), script.indexOf('function focusTargetAfterDelete'));
    assert.doesNotMatch(del, /historySearch\.focus\(\)/, 'no longer jumps to the search field');
    assert.match(del, /pendingDeleteFocus = \{ before, deletedId: id, fromRequest: historyRequest \+ 1 \};\s*reloadVisible\(\);/);
    assert.match(script, /renderHistory\(s, last\);\s*const focus = pendingDeleteFocus;\s*if \(focus && request >= focus\.fromRequest\)/);
    assert.match(script, /remove\.dataset\.entryId = entry\.id;/);
    assert.match(script, /\(target \?\? byId\('history-title'\)\)\.focus\(\);/);
    assert.match(html, /<h1 class="section-title" id="history-title" data-text="navHistory" tabindex="-1">/, 'a heading takes focus only with tabindex');
  });

  it('a focus the person moved meanwhile stays, and a stale target never fires on another screen or search', () => {
    assert.match(script, /function focusAfterDelete\(id: string \| null\): void \{\s*const active = document\.activeElement;\s*if \(active && active !== document\.body\) return;/);
    assert.match(script, /if \(mode === 'fresh'\) pendingDeleteFocus = null;/);
    const showSection = /function showSection\(name: SectionName\): void \{[\s\S]*?\n\}\n/.exec(script)?.[0] ?? '';
    assert.match(showSection, /pendingDeleteFocus = null;/);
  });
});
