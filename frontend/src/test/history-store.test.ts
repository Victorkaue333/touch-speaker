import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { PagePosition } from '../main/history/ipc';
import { applyMigrations, type Migration, readMigrations } from '../main/history/migrations';
import { retentionCutoff } from '../main/history/retention';
import { normalizeForSearch } from '../main/history/search';
import { type HistoryRow, type HistoryStore, openSqliteHistory } from '../main/history/store';

// TEST-015 — spec docs/spec/features/historico.md §9 (FR-HIST-05, 07, 08, 10, 14, 15, 16; criteria 6, 8, 9, 14,
// 15, 16) and docs/spec/features/historico-dados-v1.md (FR-HIST-27…29). Real SQLite (node:sqlite, ADR-09) on a
// temporary folder — never the user's LOCALAPPDATA.

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'local');
const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const nowIso = () => new Date(NOW).toISOString();
const DAY = 86_400_000;

let dir = '';
const dbFile = () => path.join(dir, 'touch-speaker.db');
const open = (migrations: readonly Migration[] = readMigrations(MIGRATIONS_DIR)) =>
  openSqliteHistory({ file: dbFile(), dir, migrations, nowIso });

function row(daysAgo: number, text: string, extra: Partial<HistoryRow> = {}): HistoryRow {
  return { id: randomUUID(), createdAt: new Date(NOW - daysAgo * DAY).toISOString(), text, audioMs: 4200, status: 'inserted', ...extra };
}

/** The bytes of the database and its WAL, as a search with Select-String would read them (criteria 14, 15). */
function onDisk(): Buffer {
  const parts = [dbFile(), `${dbFile()}-wal`].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f));
  return Buffer.concat(parts);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-history-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('migration 0001 (historico-dados-v1)', () => {
  it('creates dictations with exactly the five columns of §9, the index, and records version 1 (criterion 6)', () => {
    const store = open();
    assert.equal(store.schemaVersion, 1);
    store.close();
    const db = new DatabaseSync(dbFile());
    const columns = (db.prepare('PRAGMA table_info(dictations)').all() as { name: string }[]).map((c) => c.name);
    assert.deepEqual(columns, ['id', 'created_at', 'text', 'audio_ms', 'status']);
    const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'dictations'").all() as {
      name: string;
    }[]).map((i) => i.name);
    assert.ok(indexes.includes('idx_dictations_created_at'));
    const applied = db.prepare('SELECT version, applied_at FROM schema_migrations').all().map((r) => ({ ...r }));
    assert.deepEqual(applied, [{ version: 1, applied_at: nowIso() }]);
    assert.equal((db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode, 'wal');
    db.close();
  });

  it('opening again applies nothing new and keeps the entries', () => {
    const first = open();
    first.save(row(1, 'continua aqui'), { kind: 'none' });
    first.close();
    const again = open();
    assert.equal(again.schemaVersion, 1);
    assert.equal(again.count(), 1);
    again.close();
  });

  it('a database already past the newest known migration is left untouched: schema_too_new (FR-HIST-28)', () => {
    open().close();
    const db = new DatabaseSync(dbFile());
    db.exec("INSERT INTO schema_migrations (version, applied_at) VALUES (2, '2026-12-01T00:00:00.000Z')");
    db.close();
    const before = fs.readFileSync(dbFile());
    assert.throws(() => open(), { name: 'schema_too_new' });
    assert.deepEqual(fs.readFileSync(dbFile()), before);
  });

  it('a failing migration rolls back whole: no half table, no version recorded (FR-HIST-29)', () => {
    const migrations: Migration[] = [
      ...readMigrations(MIGRATIONS_DIR),
      { version: 2, name: 'broken', sql: 'CREATE TABLE half (a TEXT); SELECT * FROM missing_table;' },
    ];
    assert.throws(() => open(migrations));
    const db = new DatabaseSync(dbFile());
    const versions = (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version);
    assert.deepEqual(versions, [1]);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = 'half'").get(), undefined);
    db.close();
  });

  it('readMigrations: numbered files only, in order; none at all is an error', () => {
    assert.deepEqual(
      readMigrations(MIGRATIONS_DIR).map((m) => [m.version, m.name]),
      [[1, 'init']],
    );
    const empty = path.join(dir, 'empty');
    fs.mkdirSync(empty);
    fs.writeFileSync(path.join(empty, 'notes.txt'), 'x');
    assert.throws(() => readMigrations(empty), { name: 'migrations_missing' });
  });

  it('applyMigrations on an in-memory database', () => {
    const db = new DatabaseSync(':memory:');
    assert.deepEqual(applyMigrations(db, readMigrations(MIGRATIONS_DIR), nowIso), { version: 1, applied: 1 });
    assert.deepEqual(applyMigrations(db, readMigrations(MIGRATIONS_DIR), nowIso), { version: 1, applied: 0 });
    db.close();
  });
});

describe('opening failures (FR-HIST-16)', () => {
  it('a corrupt file (random bytes) throws and is not repaired, renamed or deleted (criterion 16, D7)', () => {
    const garbage = randomBytes(8192);
    fs.writeFileSync(dbFile(), garbage);
    assert.throws(() => open(), (err: unknown) => (err as { code?: string }).code === 'ERR_SQLITE_ERROR');
    assert.deepEqual(fs.readFileSync(dbFile()), garbage);
  });

  it('a driver that does not load throws before touching the disk', () => {
    const failing = () => {
      throw Object.assign(new Error('No such built-in module: node:sqlite'), { code: 'ERR_UNKNOWN_BUILTIN_MODULE' });
    };
    assert.throws(
      () => openSqliteHistory({ file: dbFile(), dir, migrations: readMigrations(MIGRATIONS_DIR), nowIso, loadDriver: failing }),
      { code: 'ERR_UNKNOWN_BUILTIN_MODULE' },
    );
    assert.equal(fs.existsSync(dbFile()), false);
  });
});

describe('HistoryStore', () => {
  let store: HistoryStore;
  beforeEach(() => {
    store = open();
  });
  afterEach(() => {
    store.close();
  });

  it('save is idempotent on the sessionId and keeps exactly what came (FR-HIST-01, FR-HIST-05)', () => {
    const entry = row(0, 'teste de histórico', { status: 'copied', audioMs: 12_345 });
    assert.deepEqual(store.save(entry, { kind: 'none' }), { inserted: true, purged: 0 });
    assert.deepEqual(store.save({ ...entry, text: 'outro texto' }, { kind: 'none' }), { inserted: false, purged: 0 });
    assert.deepEqual(store.get(entry.id), entry);
    assert.equal(store.count(), 1);
  });

  it('a CHECK violation is a failed write, not a silent skip (so it counts in unsavedCount)', () => {
    assert.throws(() => store.save(row(0, ''), { kind: 'none' }));
    assert.throws(() => store.save(row(0, 'x', { status: 'cancelled' as HistoryRow['status'] }), { kind: 'none' }));
    assert.throws(() => store.save(row(0, 'x', { audioMs: -1 }), { kind: 'none' }));
    assert.equal(store.count(), 0);
  });

  it('the retention purge runs in the same transaction as the save (FR-HIST-07)', () => {
    store.save(row(40, 'velho'), { kind: 'none' });
    store.save(row(10, 'recente'), { kind: 'none' });
    const result = store.save(row(0, 'novo'), retentionCutoff(30, NOW));
    assert.deepEqual(result, { inserted: true, purged: 1 });
    assert.equal(store.count(), 2);
  });

  it('purge with 30, 0 and null (criterion 8)', () => {
    store.save(row(40, 'quarenta'), { kind: 'none' });
    store.save(row(10, 'dez'), { kind: 'none' });
    assert.equal(store.purge(retentionCutoff(null, NOW)), 0);
    assert.equal(store.count(), 2);
    assert.equal(store.purge(retentionCutoff(30, NOW)), 1);
    assert.equal(store.list({ term: '', after: null, limit: 10 }).rows[0]?.text, 'dez');
    assert.equal(store.purge(retentionCutoff(0, NOW)), 1);
    assert.equal(store.count(), 0);
  });

  it('pages of 50, newest first, with a cursor; the third page brings the last 20 (criterion 9)', () => {
    for (let i = 0; i < 120; i++) store.save(row(i / 100, `ditado ${i}`), { kind: 'none' });
    const first = store.list({ term: '', after: null, limit: 50 });
    assert.equal(first.rows.length, 50);
    assert.equal(first.rows[0]?.text, 'ditado 0');
    assert.ok(first.next);
    const second = store.list({ term: '', after: first.next, limit: 50 });
    assert.equal(second.rows[0]?.text, 'ditado 50');
    const third = store.list({ term: '', after: second.next, limit: 50 });
    assert.equal(third.rows.length, 20);
    assert.equal(third.rows.at(-1)?.text, 'ditado 119');
    assert.equal(third.next, null);
    const all = [...first.rows, ...second.rows, ...third.rows].map((r) => r.createdAt);
    assert.deepEqual(all, [...all].sort().reverse());
  });

  it('two entries in the same millisecond page by id, without loss or repetition', () => {
    const at = new Date(NOW).toISOString();
    const ids = Array.from({ length: 5 }, () => randomUUID());
    for (const id of ids) store.save({ id, createdAt: at, text: id, audioMs: 1, status: 'inserted' }, { kind: 'none' });
    const seen: string[] = [];
    let after: PagePosition | null = null;
    do {
      const page = store.list({ term: '', after, limit: 2 });
      seen.push(...page.rows.map((r) => r.id));
      after = page.next;
    } while (after);
    assert.deepEqual(seen, [...ids].sort().reverse());
  });

  it('search ignores case, accents and punctuation (criterion 11)', () => {
    store.save(row(0, 'Não, quer dizer, faz o deploy'), { kind: 'none' });
    store.save(row(1, 'Manda o link do PR no Slack.'), { kind: 'none' });
    const find = (term: string) => store.list({ term: normalizeForSearch(term), after: null, limit: 50 }).rows.map((r) => r.text);
    assert.deepEqual(find('nao quer'), ['Não, quer dizer, faz o deploy']);
    assert.deepEqual(find('DEPLOY'), ['Não, quer dizer, faz o deploy']);
    assert.deepEqual(find('slack'), ['Manda o link do PR no Slack.']);
    assert.deepEqual(find('kubernetes'), []);
  });

  it('remove: gone from the list and unreadable in the .db and the -wal (FR-HIST-14, criterion 14)', () => {
    const keep = row(1, 'fica no histórico');
    const gone = row(0, 'a palavra zebracapivara some');
    store.save(keep, { kind: 'none' });
    store.save(gone, { kind: 'none' });
    assert.ok(onDisk().includes('zebracapivara'));
    assert.equal(store.remove(gone.id), true);
    assert.equal(store.remove(gone.id), false);
    assert.equal(store.get(gone.id), null);
    assert.ok(!onDisk().includes('zebracapivara'));
    assert.ok(onDisk().includes('fica no hist'));
  });

  it('clear: everything goes, the WAL is emptied and the file shrinks (FR-HIST-15, criterion 15)', () => {
    for (let i = 0; i < 300; i++) store.save(row(i / 300, `ornitorrinco número ${i} ${'texto '.repeat(40)}`), { kind: 'none' });
    store.purge({ kind: 'none' });
    const big = fs.statSync(dbFile()).size + (fs.existsSync(`${dbFile()}-wal`) ? fs.statSync(`${dbFile()}-wal`).size : 0);
    assert.equal(store.clear(), 300);
    assert.equal(store.count(), 0);
    const small = fs.statSync(dbFile()).size + (fs.existsSync(`${dbFile()}-wal`) ? fs.statSync(`${dbFile()}-wal`).size : 0);
    assert.ok(small < big, `${small} < ${big}`);
    assert.ok(!onDisk().includes('ornitorrinco'));
  });

  it('scan visits only what the totals need, newest first, optionally since an instant', () => {
    store.save(row(3, 'três dias'), { kind: 'none' });
    store.save(row(0, 'hoje'), { kind: 'none' });
    const all: string[] = [];
    store.scan(null, (r) => {
      assert.deepEqual(Object.keys(r).sort(), ['audioMs', 'createdAt', 'text']);
      all.push(r.text);
    });
    assert.deepEqual(all, ['hoje', 'três dias']);
    const recent: string[] = [];
    store.scan(new Date(NOW - DAY).toISOString(), (r) => recent.push(r.text));
    assert.deepEqual(recent, ['hoje']);
  });

  it('reference volume (10 000 entries of 500 characters): page and search stay fast (§6, sanity check)', () => {
    const text = 'palavra '.repeat(62).slice(0, 500);
    const insert = new DatabaseSync(dbFile());
    insert.exec('BEGIN');
    const statement = insert.prepare('INSERT INTO dictations (id, created_at, text, audio_ms, status) VALUES (?, ?, ?, ?, ?)');
    for (let i = 0; i < 10_000; i++) statement.run(randomUUID(), new Date(NOW - i * 60_000).toISOString(), `${text} n${i}`, 9000, 'inserted');
    insert.exec('COMMIT');
    insert.close();
    let started = performance.now();
    assert.equal(store.list({ term: '', after: null, limit: 50 }).rows.length, 50);
    const pageMs = performance.now() - started;
    started = performance.now();
    assert.equal(store.list({ term: normalizeForSearch('n9999'), after: null, limit: 50 }).rows.length, 1);
    const searchMs = performance.now() - started;
    // Generous bounds: no CI and no reference machine; §6 has 30 ms and 150 ms (p95) as the targets.
    assert.ok(pageMs < 300, `page ${pageMs.toFixed(1)} ms`);
    assert.ok(searchMs < 1500, `search ${searchMs.toFixed(1)} ms`);
  });
});
