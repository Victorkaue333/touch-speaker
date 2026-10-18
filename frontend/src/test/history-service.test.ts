import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ConfigWriter, DEFAULT_CONFIG, normalizeConfig } from '../main/config';
import { systemTimeZone } from '../main/history/format';
import { historyErrorName, HistoryService, openHistory, type HistoryServiceDeps } from '../main/history/service';
import type { HistoryRow, HistoryStore } from '../main/history/store';
import type { HistoryChangeReason, HistoryEntry } from '../shared/ipc';
import { MIGRATIONS_DIR, memoryStore, RecordingLog } from './history-fakes';

// TEST-017 — spec docs/spec/features/historico.md: the service behind history:* (FR-HIST-07, 08, 11, 12, 13, 15,
// 18, 20, 21; criteria 8, 13, 17, 20, 21) and the usage aggregate of Início (FR-HIST-22…24, 26).

const NOW = Date.parse('2026-10-18T15:00:00.000Z'); // 12:00 in São Paulo
const DAY = 86_400_000;
const TZ = 'America/Sao_Paulo';

let dir = '';
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-history-service-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function row(msAgo: number, text: string, extra: Partial<HistoryRow> = {}): HistoryRow {
  return { id: randomUUID(), createdAt: new Date(NOW - msAgo).toISOString(), text, audioMs: 6000, status: 'inserted', ...extra };
}

interface ServiceRig {
  service: HistoryService;
  store: HistoryStore;
  log: RecordingLog;
  clipboard: string[];
  changes: HistoryChangeReason[];
}

function rig(overrides: Partial<HistoryServiceDeps> = {}, store: HistoryStore = memoryStore()): ServiceRig {
  const log = new RecordingLog();
  const clipboard: string[] = [];
  const changes: HistoryChangeReason[] = [];
  const service = new HistoryService({
    store,
    retentionDays: 30,
    writer: new ConfigWriter(dir),
    clipboard: { writeText: (t) => clipboard.push(t) },
    notify: (reason) => changes.push(reason),
    log,
    now: () => NOW,
    timeZone: TZ,
    ...overrides,
  });
  return { service, store, log, clipboard, changes };
}

const list = (r: ServiceRig, query = '') => r.service.list({ query, after: null, limit: 50 });
const pick = (entry: HistoryEntry | undefined) => [entry?.dayKey, entry?.dayLabel, entry?.timeLabel];

describe('history:list states (FR-HIST-08, FR-HIST-11)', () => {
  it('ok with entries and labels; disabled with retention 0; unavailable without a database', () => {
    const r = rig();
    r.store.save(row(0, 'teste de histórico', { status: 'copied' }), { kind: 'none' });
    const ok = list(r);
    assert.equal(ok.status, 'ok');
    assert.equal(ok.retentionLabel, 'Guardando os ditados dos últimos 30 dias');
    assert.equal(ok.entries[0]?.statusLabel, 'Não colado — o texto ficou no clipboard');
    assert.equal(ok.entries[0]?.copyLabel, 'Copiar ditado — Hoje, 12:00');
    assert.equal(ok.entries[0]?.deleteLabel, 'Apagar ditado — Hoje, 12:00');
    assert.equal(ok.unsavedLabel, null);
    assert.equal(list(rig({ retentionDays: 0 })).status, 'disabled');
    const none = list(rig({ store: null }));
    assert.deepEqual([none.status, none.entries, none.nextCursor], ['unavailable', [], null]);
  });

  it('a search with no match answers ok with no entries — the screen shows "Nenhum ditado com esse termo"', () => {
    const r = rig();
    r.store.save(row(0, 'Não, quer dizer, faz o deploy'), { kind: 'none' });
    assert.equal(list(r, 'nao quer').entries.length, 1);
    const none = list(r, 'kubernetes');
    assert.deepEqual([none.status, none.entries.length], ['ok', 0]);
  });

  it('a search that normalizes to nothing ("?!", emoji) lists no entries, never the whole history', () => {
    const r = rig();
    r.store.save(row(0, 'Não, quer dizer?!'), { kind: 'none' });
    r.store.save(row(1000, 'outro ditado 🙂'), { kind: 'none' });
    for (const query of ['?!', '🙂', '…']) {
      const none = list(r, query);
      assert.deepEqual([none.status, none.entries.length, none.nextCursor], ['ok', 0, null], query);
    }
    assert.equal(list(r).entries.length, 2, 'no search still lists everything');
    assert.ok(!r.log.dump().includes('?!'), 'the term never reaches the log');
  });

  it('a search in another script finds its entry (FR-HIST-10)', () => {
    const r = rig();
    r.store.save(row(0, 'Reunião com a equipe de Москва'), { kind: 'none' });
    r.store.save(row(1000, 'Revisar o 日本語 do manual'), { kind: 'none' });
    r.store.save(row(2000, 'nada a ver'), { kind: 'none' });
    assert.deepEqual(list(r, 'москва').entries.map((e) => e.text), ['Reunião com a equipe de Москва']);
    assert.deepEqual(list(r, '日本').entries.map((e) => e.text), ['Revisar o 日本語 do manual']);
  });

  it('without a pinned zone, list and stats follow a time zone change with the app open (§6 "Fuso horário")', () => {
    const original = systemTimeZone();
    try {
      process.env.TZ = TZ;
      const now = Date.parse('2026-10-18T13:00:00.000Z'); // 10:00 in São Paulo, 22:00 in Tokyo, both 18/out
      const r = rig({ timeZone: undefined, now: () => now });
      r.store.save(row(0, 'fim de tarde', { createdAt: '2026-10-17T23:30:00.000Z' }), { kind: 'none' }); // 17/out SP, 18/out Tokyo
      assert.deepEqual(pick(list(r).entries[0]), ['2026-10-17', 'Ontem', '20:30']);
      assert.equal(r.service.stats().today.dictations, 0);
      process.env.TZ = 'Asia/Tokyo';
      assert.deepEqual(pick(list(r).entries[0]), ['2026-10-18', 'Hoje', '08:30']);
      assert.equal(r.service.stats().today.dictations, 1);
    } finally {
      process.env.TZ = original; // deleting TZ would not move V8's zone back
    }
  });

  it('nextCursor drives the next page (criterion 9)', () => {
    const r = rig();
    for (let i = 0; i < 120; i++) r.store.save(row(i * 1000, `d${i}`), { kind: 'none' });
    let page = r.service.list({ query: '', after: null, limit: 50 });
    const texts = page.entries.map((e) => e.text);
    while (page.nextCursor) {
      const at = page.nextCursor.indexOf('~');
      page = r.service.list({ query: '', after: { createdAt: page.nextCursor.slice(0, at), id: page.nextCursor.slice(at + 1) }, limit: 50 });
      texts.push(...page.entries.map((e) => e.text));
    }
    assert.equal(texts.length, 120);
    assert.equal(new Set(texts).size, 120);
  });
});

describe('history:copy, history:delete, history:clear (FR-HIST-12…15, FR-HIST-18)', () => {
  it('copy writes the text to the clipboard through main', () => {
    const r = rig();
    const entry = row(0, 'cola isso de novo');
    r.store.save(entry, { kind: 'none' });
    assert.deepEqual(r.service.copy(entry.id), { result: 'copied' });
    assert.deepEqual(r.clipboard, ['cola isso de novo']);
    assert.ok(r.log.events().includes('history_copied'));
    assert.ok(!r.log.dump().includes('cola isso'));
  });

  it('an entry deleted since the last list answers not_found and leaves the clipboard alone (criterion 13)', () => {
    const r = rig();
    const entry = row(0, 'some');
    r.store.save(entry, { kind: 'none' });
    assert.deepEqual(r.service.remove(entry.id), { result: 'deleted' });
    assert.deepEqual(r.service.copy(entry.id), { result: 'not_found' });
    assert.deepEqual(r.service.remove(entry.id), { result: 'not_found' });
    assert.deepEqual(r.clipboard, []);
    assert.deepEqual(r.changes, ['deleted']);
  });

  it('clear removes everything and tells the window (FR-HIST-15)', () => {
    const r = rig();
    for (let i = 0; i < 3; i++) r.store.save(row(i, `t${i}`), { kind: 'none' });
    assert.deepEqual(r.service.clear(), { result: 'cleared', count: 3 });
    assert.equal(r.store.count(), 0);
    assert.deepEqual(r.changes, ['cleared']);
    assert.deepEqual(r.log.lines.at(-1), { level: 'info', event: 'history_cleared', fields: { count: 3 } });
  });

  it('without a database every action answers unavailable', () => {
    const r = rig({ store: null });
    assert.deepEqual(r.service.copy(randomUUID()), { result: 'unavailable' });
    assert.deepEqual(r.service.remove(randomUUID()), { result: 'unavailable' });
    assert.deepEqual(r.service.clear(), { result: 'unavailable', count: 0 });
  });

  it('save notifies "saved"; with retention 0 or no database it writes nothing and stays quiet', () => {
    const r = rig();
    r.service.save({ id: randomUUID(), createdAt: new Date(NOW).toISOString(), text: 'oi', audioMs: 900.4, status: 'inserted' });
    assert.deepEqual(r.changes, ['saved']);
    assert.equal(r.store.list({ term: '', after: null, limit: 1 }).rows[0]?.audioMs, 900);
    const off = rig({ retentionDays: 0 });
    off.service.save({ id: randomUUID(), createdAt: new Date(NOW).toISOString(), text: 'oi', audioMs: 1, status: 'inserted' });
    assert.equal(off.store.count(), 0);
    assert.deepEqual([off.changes, off.log.lines], [[], []]);
  });
});

describe('history:set-retention (FR-HIST-20, FR-HIST-21)', () => {
  const file = () => path.join(dir, 'config.json');
  const readJson = () => JSON.parse(fs.readFileSync(file(), 'utf8')) as Record<string, unknown>;

  it('writes only history.retentionDays, keeps unknown fields, purges at once and tells the window (criterion 20)', async () => {
    fs.writeFileSync(file(), JSON.stringify({ ...DEFAULT_CONFIG, hotkey: 'F13', history: { retentionDays: 30, other: 'x' }, extra: 1 }));
    const r = rig();
    r.store.save(row(10 * DAY, 'dez dias'), { kind: 'none' });
    r.store.save(row(1 * DAY, 'ontem'), { kind: 'none' });
    const result = await r.service.setRetention(7);
    assert.deepEqual(result, { result: 'saved', retentionDays: 7, purged: 1, savedLabel: 'Salvo · 1 ditado mais antigo foi apagado' });
    const json = readJson();
    assert.deepEqual(json.history, { retentionDays: 7, other: 'x' });
    assert.equal(json.extra, 1);
    assert.equal(json.hotkey, 'F13');
    assert.equal(json.version, 1);
    assert.equal(r.store.count(), 1);
    assert.deepEqual(r.changes, ['purged']);
    assert.deepEqual(r.service.getRetention(), { retentionDays: 7, retentionLabel: 'Guardando os ditados dos últimos 7 dias' });
    const changed = r.log.lines.find((l) => l.event === 'history_retention_changed');
    assert.deepEqual(changed?.fields, { retention_days: 7, purged: 1 });
  });

  it('"para sempre" (null) is written as null and read back by normalizeConfig (FR-UI-38)', async () => {
    fs.writeFileSync(file(), JSON.stringify(DEFAULT_CONFIG));
    const r = rig();
    const result = await r.service.setRetention(null);
    assert.equal(result.result, 'saved');
    assert.equal(result.savedLabel, 'Salvo');
    assert.deepEqual(readJson().history, { retentionDays: null });
    assert.equal(normalizeConfig(readJson(), () => assert.fail('warned')).history.retentionDays, null);
  });

  it('"nunca guardar" (0) purges everything at once', async () => {
    fs.writeFileSync(file(), JSON.stringify(DEFAULT_CONFIG));
    const r = rig();
    r.store.save(row(0, 'agora'), { kind: 'none' });
    const result = await r.service.setRetention(0);
    assert.equal(result.purged, 1);
    assert.equal(list(r).status, 'disabled');
  });

  it('a config.json that is not JSON is not overwritten and the retention in use stays (criterion 21)', async () => {
    fs.writeFileSync(file(), '{ not json');
    const r = rig();
    r.store.save(row(10 * DAY, 'dez dias'), { kind: 'none' });
    assert.deepEqual(await r.service.setRetention(7), { result: 'write_failed', retentionDays: 30, purged: 0, savedLabel: null });
    assert.equal(fs.readFileSync(file(), 'utf8'), '{ not json');
    assert.equal(r.store.count(), 1);
    assert.equal(r.service.getRetention().retentionDays, 30);
    assert.deepEqual(r.log.lines.at(-1), { level: 'error', event: 'config_write_failed', fields: { name: 'invalid_json' } });
  });

  it('a missing config.json is recreated with the defaults and the new retention', async () => {
    const r = rig();
    await r.service.setRetention(90);
    const json = readJson();
    assert.deepEqual(json.history, { retentionDays: 90 });
    assert.equal(json.hotkey, DEFAULT_CONFIG.hotkey);
  });
});

describe('history:stats — the usage of Início (FR-HIST-22…24, FR-HIST-26)', () => {
  it('today (local day) and all time: words, dictations, time spoken; words per minute over entries with audio', () => {
    const r = rig();
    // Today in São Paulo: 10:00 and 00:30 local. Yesterday 23:30 local is already 18/out in UTC.
    r.store.save(row(2 * 3600_000, 'um dois três quatro', { audioMs: 2000 }), { kind: 'none' });
    r.store.save(row(11.5 * 3600_000, 'cinco seis', { audioMs: 1000 }), { kind: 'none' });
    r.store.save(row(12.5 * 3600_000, 'ontem à noite foi', { audioMs: 3000 }), { kind: 'none' });
    r.store.save(row(5 * DAY, 'sem duração nenhuma', { audioMs: 0 }), { kind: 'none' });
    const stats = r.service.stats();
    assert.equal(stats.status, 'ok');
    assert.deepEqual(
      { ...stats.today },
      { words: 6, dictations: 2, spokenMs: 3000, wordsLabel: '6', dictationsLabel: '2', spokenLabel: '3 s' },
    );
    assert.deepEqual(
      { ...stats.allTime },
      { words: 13, dictations: 4, spokenMs: 6000, wordsLabel: '13', dictationsLabel: '4', spokenLabel: '6 s' },
    );
    // 10 words over 6 s of audio (the entry without duration is left out) = 100 words per minute.
    assert.equal(stats.wordsPerMinute, 100);
    assert.equal(stats.wordsPerMinuteLabel, '100');
    assert.equal(stats.retentionLabel, 'Guardando os ditados dos últimos 30 dias');
  });

  it('an empty history has zeros and no words per minute', () => {
    const stats = rig().service.stats();
    assert.equal(stats.status, 'ok');
    assert.equal(stats.allTime.dictations, 0);
    assert.equal(stats.wordsPerMinute, null);
    assert.equal(stats.wordsPerMinuteLabel, '—');
  });

  it('"nunca guardar" and no database answer disabled and unavailable, never a text', () => {
    assert.equal(rig({ retentionDays: 0 }).service.stats().status, 'disabled');
    assert.equal(rig({ store: null }).service.stats().status, 'unavailable');
    const r = rig();
    r.store.save(row(0, 'segredo zebracapivara'), { kind: 'none' });
    assert.ok(!JSON.stringify(r.service.stats()).includes('zebracapivara'));
  });
});

describe('openHistory (FR-HIST-07 at startup, FR-HIST-16)', () => {
  const location = () => ({ ok: true as const, dir: path.join(dir, 'Touch Speaker'), file: path.join(dir, 'Touch Speaker', 'touch-speaker.db') });

  it('creates the folder and the file, purges with the retention in use and logs history_ready', () => {
    const log = new RecordingLog();
    const store = openHistory({ location: location(), migrationsDir: MIGRATIONS_DIR, retentionDays: 30, log, now: () => NOW });
    assert.ok(store);
    store.save(row(40 * DAY, 'velho'), { kind: 'none' });
    store.save(row(DAY, 'novo'), { kind: 'none' });
    store.close();
    const again = openHistory({ location: location(), migrationsDir: MIGRATIONS_DIR, retentionDays: 30, log, now: () => NOW });
    assert.equal(again?.count(), 1);
    again?.close();
    const ready = log.lines.filter((l) => l.event === 'history_ready').at(-1);
    assert.deepEqual(ready?.fields, { schema_version: 1, entries: 1, purged: 1, open_ms: 0 });
  });

  it('no LOCALAPPDATA, a corrupt file or missing migrations: null and history_unavailable with the name only', () => {
    const log = new RecordingLog();
    assert.equal(openHistory({ location: { ok: false, reason: 'no_localappdata' }, migrationsDir: MIGRATIONS_DIR, retentionDays: 30, log }), null);
    fs.mkdirSync(location().dir, { recursive: true });
    fs.writeFileSync(location().file, 'isto não é um banco de dados'.repeat(400));
    assert.equal(openHistory({ location: location(), migrationsDir: MIGRATIONS_DIR, retentionDays: 30, log }), null);
    assert.equal(openHistory({ location: location(), migrationsDir: path.join(dir, 'nowhere'), retentionDays: 30, log }), null);
    assert.deepEqual(
      log.lines.map((l) => [l.event, l.fields.name]),
      [
        ['history_unavailable', 'no_localappdata'],
        ['history_unavailable', 'SQLITE_26'],
        ['history_unavailable', 'ENOENT'],
      ],
    );
  });

  it('historyErrorName: the SQLite code or the errno, never the message', () => {
    assert.equal(historyErrorName(Object.assign(new Error('disk I/O'), { code: 'ERR_SQLITE_ERROR', errcode: 10 })), 'SQLITE_10');
    assert.equal(historyErrorName(Object.assign(new Error('x'), { code: 'EPERM' })), 'EPERM');
    assert.equal(historyErrorName('nope'), 'unknown');
  });
});
