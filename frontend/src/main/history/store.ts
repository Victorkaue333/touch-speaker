// The dictation history in SQLite (spec historico §8, §9; ADR-09): one file in the local folder, opened only by
// the main process, one connection, WAL, secure_delete. The driver is Node's built-in `node:sqlite` (ADR-09,
// spike T1): no third-party package. It is required inside openSqliteHistory, not at import time, so a runtime
// without it makes the history unavailable instead of stopping the app (FR-HIST-16). With migrations.ts, the
// only file that touches the driver. Never logs and never sees anything but the five columns of §9.
import * as fs from 'node:fs';
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { HistoryEntryStatus } from '../../shared/ipc';
import type { PagePosition } from './ipc';
import { applyMigrations, type Migration } from './migrations';
import type { RetentionCutoff } from './retention';
import { normalizeForSearch } from './search';

/** One entry, exactly the columns of `dictations` (spec historico §9, FR-HIST-05). */
export interface HistoryRow {
  id: string;
  createdAt: string;
  text: string;
  audioMs: number;
  status: HistoryEntryStatus;
}

export interface HistoryPageQuery {
  /** Already normalized with normalizeForSearch; '' = no search. */
  term: string;
  after: PagePosition | null;
  limit: number;
}

export interface HistoryPage {
  rows: HistoryRow[];
  /** Position of the last row when there is a next page, else null. */
  next: PagePosition | null;
}

/** What the usage aggregate reads: no id, no status — only what the totals need. */
export interface UsageRow {
  createdAt: string;
  text: string;
  audioMs: number;
}

/** The history storage. Swapping the driver means rewriting this file and migrations.ts (spec §8). */
export interface HistoryStore {
  readonly schemaVersion: number;
  /** Idempotent on `id`; the retention purge runs in the same transaction. */
  save(row: HistoryRow, cutoff: RetentionCutoff): { inserted: boolean; purged: number };
  list(query: HistoryPageQuery): HistoryPage;
  get(id: string): HistoryRow | null;
  remove(id: string): boolean;
  /** Deletes everything, empties the WAL and compacts the file; returns how many entries went. */
  clear(): number;
  purge(cutoff: RetentionCutoff): number;
  count(): number;
  /** Visits the entries created at or after `sinceIso` (all of them when null), newest first. */
  scan(sinceIso: string | null, visit: (row: UsageRow) => void): void;
  close(): void;
}

interface RawRow {
  id: string;
  created_at: string;
  text: string;
  audio_ms: number | bigint;
  status: HistoryEntryStatus;
}

const toRow = (raw: RawRow): HistoryRow => ({
  id: raw.id,
  createdAt: raw.created_at,
  text: raw.text,
  audioMs: Number(raw.audio_ms),
  status: raw.status,
});

const COLUMNS = 'id, created_at, text, audio_ms, status';
const ORDER = 'ORDER BY created_at DESC, id DESC';
const MATCH = 'instr(ts_normalize(text), :term) > 0';
const AFTER = '(created_at < :createdAt OR (created_at = :createdAt AND id < :id))';

class SqliteHistoryStore implements HistoryStore {
  private readonly insert: StatementSync;
  private readonly byId: StatementSync;
  private readonly deleteOne: StatementSync;
  private readonly deleteAll: StatementSync;
  private readonly deleteBefore: StatementSync;
  private readonly countAll: StatementSync;
  private readonly pages = new Map<string, StatementSync>();

  constructor(
    private readonly db: DatabaseSync,
    readonly schemaVersion: number,
  ) {
    // ON CONFLICT (id) DO NOTHING, not INSERT OR IGNORE: only the repeated sessionId is ignored; a CHECK or
    // NOT NULL violation still fails, so it counts as a failed write (FR-HIST-17) instead of vanishing.
    this.insert = db.prepare(
      `INSERT INTO dictations (${COLUMNS}) VALUES (:id, :createdAt, :text, :audioMs, :status) ON CONFLICT (id) DO NOTHING`,
    );
    this.byId = db.prepare(`SELECT ${COLUMNS} FROM dictations WHERE id = ?`);
    this.deleteOne = db.prepare('DELETE FROM dictations WHERE id = ?');
    this.deleteAll = db.prepare('DELETE FROM dictations');
    this.deleteBefore = db.prepare('DELETE FROM dictations WHERE created_at < ?');
    this.countAll = db.prepare('SELECT COUNT(*) AS n FROM dictations');
  }

  save(row: HistoryRow, cutoff: RetentionCutoff): { inserted: boolean; purged: number } {
    let inserted = false;
    let purged = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      inserted = Number(this.insert.run({ ...row }).changes) > 0;
      purged = this.purgeRows(cutoff);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    if (purged > 0) this.checkpoint();
    return { inserted, purged };
  }

  list({ term, after, limit }: HistoryPageQuery): HistoryPage {
    const conditions = [after ? AFTER : '', term ? MATCH : ''].filter(Boolean);
    const sql = `SELECT ${COLUMNS} FROM dictations${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''} ${ORDER} LIMIT :limit`;
    let statement = this.pages.get(sql);
    if (!statement) {
      statement = this.db.prepare(sql);
      this.pages.set(sql, statement);
    }
    const params: Record<string, string | number> = { limit: limit + 1 };
    if (after) {
      params.createdAt = after.createdAt;
      params.id = after.id;
    }
    if (term) params.term = term;
    const rows = (statement.all(params) as unknown as RawRow[]).map(toRow);
    const more = rows.length > limit;
    if (more) rows.length = limit;
    const last = rows.at(-1);
    return { rows, next: more && last ? { createdAt: last.createdAt, id: last.id } : null };
  }

  get(id: string): HistoryRow | null {
    const raw = this.byId.get(id) as unknown as RawRow | undefined;
    return raw ? toRow(raw) : null;
  }

  remove(id: string): boolean {
    const removed = Number(this.deleteOne.run(id).changes) > 0;
    // secure_delete zeroes the freed bytes; the checkpoint takes the old page out of the WAL (FR-HIST-14).
    if (removed) this.checkpoint();
    return removed;
  }

  clear(): number {
    const count = Number(this.deleteAll.run().changes);
    this.checkpoint();
    this.db.exec('VACUUM');
    this.checkpoint();
    return count;
  }

  purge(cutoff: RetentionCutoff): number {
    const purged = this.purgeRows(cutoff);
    if (purged > 0) this.checkpoint();
    return purged;
  }

  count(): number {
    const row = this.countAll.get() as { n: number | bigint } | undefined;
    return Number(row?.n ?? 0);
  }

  scan(sinceIso: string | null, visit: (row: UsageRow) => void): void {
    const statement = sinceIso
      ? this.db.prepare(`SELECT created_at, text, audio_ms FROM dictations WHERE created_at >= ? ${ORDER}`)
      : this.db.prepare(`SELECT created_at, text, audio_ms FROM dictations ${ORDER}`);
    const rows = (sinceIso ? statement.iterate(sinceIso) : statement.iterate()) as Iterable<{
      created_at: string;
      text: string;
      audio_ms: number | bigint;
    }>;
    for (const raw of rows) visit({ createdAt: raw.created_at, text: raw.text, audioMs: Number(raw.audio_ms) });
  }

  close(): void {
    if (this.db.isOpen) this.db.close();
  }

  private purgeRows(cutoff: RetentionCutoff): number {
    if (cutoff.kind === 'none') return 0;
    const result = cutoff.kind === 'all' ? this.deleteAll.run() : this.deleteBefore.run(cutoff.iso);
    return Number(result.changes);
  }

  private checkpoint(): void {
    this.db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  }
}

type SqliteModule = typeof import('node:sqlite');

export interface OpenHistoryOptions {
  /** Absolute path of touch-speaker.db, or ':memory:' in tests. */
  file: string;
  /** The folder to create first; omitted for ':memory:'. */
  dir?: string;
  migrations: readonly Migration[];
  nowIso: () => string;
  /** Tests only: a driver that fails to load. */
  loadDriver?: () => SqliteModule;
}

const loadNodeSqlite = (): SqliteModule => require('node:sqlite') as SqliteModule;

/** Opens (creating it if needed) and migrates the database. Throws on any failure, with nothing left open. */
export function openSqliteHistory(opts: OpenHistoryOptions): HistoryStore {
  const sqlite = (opts.loadDriver ?? loadNodeSqlite)();
  if (opts.dir) fs.mkdirSync(opts.dir, { recursive: true });
  const db = new sqlite.DatabaseSync(opts.file);
  try {
    db.prepare('PRAGMA journal_mode = WAL').get();
    db.exec('PRAGMA secure_delete = ON');
    const { version } = applyMigrations(db, opts.migrations, opts.nowIso);
    db.function('ts_normalize', { deterministic: true }, (text) => normalizeForSearch(String(text ?? '')));
    return new SqliteHistoryStore(db, version);
  } catch (err) {
    if (db.isOpen) db.close();
    throw err;
  }
}
