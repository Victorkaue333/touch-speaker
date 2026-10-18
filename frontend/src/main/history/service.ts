// The history in the main process (spec historico §8, §10): the HistoryPort the session writes to, and what
// the history:* handlers answer. Holds the retention in use (read at startup, changed by FR-HIST-20) and the
// count of failed writes since the app opened (FR-HIST-17, D15). The store is null when the database did not
// open (FR-HIST-16): then dictation goes on exactly as before and only the screens say so.
// Never logs dictated text or a search term: counts, times and error names only (C1, §6 "Observabilidade").
// No `electron` import: clipboard, notification and config writer come in (TEST-014, TEST-015, TEST-017).
import type {
  HistoryAvailability,
  HistoryChangeReason,
  HistoryClearResult,
  HistoryCopyResult,
  HistoryDeleteResult,
  HistoryEntry,
  HistoryEntryStatus,
  HistoryListResult,
  HistoryRetentionView,
  HistorySetRetentionResult,
  HistoryStatsView,
  HistoryTotals,
  RetentionDays,
} from '../../shared/ipc';
import { errorName } from '../atomic-file';
import { type ConfigUpdateResult, type RawConfig, withRetention } from '../config';
import type { LogPort } from '../logger';
import { historyStrings } from '../strings';
import { countWords, HistoryFormatter, wordsPerMinute } from './format';
import { encodeCursor, type ValidListInput } from './ipc';
import { readMigrations } from './migrations';
import type { HistoryLocation } from './paths';
import { retentionCutoff } from './retention';
import { normalizeForSearch } from './search';
import { type HistoryRow, type HistoryStore, openSqliteHistory, type OpenHistoryOptions } from './store';

/** What the session hands over once a dictation with text has ended (spec historico FR-HIST-01, FR-HIST-02). */
export interface HistoryEntryInput {
  /** sessionId of the dictation (UUID v4). */
  id: string;
  /** ISO-8601 UTC, when the insertion ended. */
  createdAt: string;
  /** Exactly the text given to the TextInserter. */
  text: string;
  audioMs: number;
  status: HistoryEntryStatus;
}

/** The session's door to the history. `save` never throws (FR-HIST-17). */
export interface HistoryPort {
  save(entry: HistoryEntryInput): void;
}

/** Error metadata of SQLite failures: the SQLite result code (SQLITE_26 = not a database…), never a message. */
export function historyErrorName(err: unknown): string {
  if (err instanceof Error) {
    const { code, errcode } = err as Error & { code?: unknown; errcode?: unknown };
    if (code === 'ERR_SQLITE_ERROR' && typeof errcode === 'number') return `SQLITE_${errcode}`;
  }
  return errorName(err);
}

export interface OpenHistoryInput {
  location: HistoryLocation;
  /** Folder of the NNNN_*.sql files (dist/database/local). */
  migrationsDir: string;
  retentionDays: RetentionDays;
  log: LogPort;
  now?: () => number;
  /** Tests only. */
  open?: (opts: OpenHistoryOptions) => HistoryStore;
}

/**
 * Opens and migrates the database, then purges with the retention in use (FR-HIST-07, at startup). Any
 * failure — no LOCALAPPDATA, driver missing, corrupt file, migration error, disk, permission — is logged as
 * history_unavailable with the error name only, and the answer is null (FR-HIST-16, D7: nothing is repaired,
 * renamed or deleted).
 */
export function openHistory(input: OpenHistoryInput): HistoryStore | null {
  const now = input.now ?? Date.now;
  const started = now();
  if (!input.location.ok) {
    input.log.warn('history_unavailable', { name: input.location.reason });
    return null;
  }
  let store: HistoryStore;
  try {
    store = (input.open ?? openSqliteHistory)({
      file: input.location.file,
      dir: input.location.dir,
      migrations: readMigrations(input.migrationsDir),
      nowIso: () => new Date(now()).toISOString(),
    });
  } catch (err) {
    input.log.warn('history_unavailable', { name: historyErrorName(err) });
    return null;
  }
  let purged = 0;
  try {
    purged = store.purge(retentionCutoff(input.retentionDays, now()));
  } catch (err) {
    input.log.warn('history_purge_failed', { name: historyErrorName(err) });
  }
  input.log.info('history_ready', {
    schema_version: store.schemaVersion,
    entries: store.count(),
    purged,
    open_ms: now() - started,
  });
  return store;
}

export interface HistoryServiceDeps {
  /** null = the database did not open (FR-HIST-16). */
  store: HistoryStore | null;
  /** In use, from config.json at startup. */
  retentionDays: RetentionDays;
  writer: { update(mutate: (raw: RawConfig) => RawConfig): Promise<ConfigUpdateResult> };
  clipboard: { writeText(text: string): void };
  /** history:changed to the main window, if open (FR-HIST-18). */
  notify(reason: HistoryChangeReason): void;
  log: LogPort;
  now?: () => number;
  /** IANA time zone; undefined = the system's. Tests pin it. */
  timeZone?: string;
}

const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const shortId = (id: string) => id.slice(0, 8);

export class HistoryService implements HistoryPort {
  private retentionDays: RetentionDays;
  private unsaved = 0;
  private readonly now: () => number;
  private readonly format: HistoryFormatter;

  constructor(private readonly deps: HistoryServiceDeps) {
    this.retentionDays = deps.retentionDays;
    this.now = deps.now ?? Date.now;
    this.format = new HistoryFormatter(deps.timeZone);
  }

  get available(): boolean {
    return this.deps.store !== null;
  }

  /** Failed writes since the app opened (FR-HIST-17). */
  get unsavedCount(): number {
    return this.unsaved;
  }

  // ---- HistoryPort (the session) ------------------------------------------------------------------

  save(entry: HistoryEntryInput): void {
    try {
      if (this.retentionDays === 0) return; // "Nunca guardar" (FR-HIST-06)
      const store = this.deps.store;
      if (!store) return; // unavailable since startup: nothing to write, dictation as always (FR-HIST-16)
      const started = this.now();
      try {
        const row: HistoryRow = { ...entry, audioMs: Math.max(0, Math.round(entry.audioMs)) };
        const { purged } = store.save(row, retentionCutoff(this.retentionDays, this.now()));
        this.deps.log.info('history_saved', { session: shortId(entry.id), write_ms: this.now() - started });
        if (purged > 0) this.deps.log.info('history_purged', { count: purged });
      } catch (err) {
        this.unsaved += 1;
        this.deps.log.warn('history_write_failed', { session: shortId(entry.id), name: historyErrorName(err) });
        return;
      }
      this.notify('saved');
    } catch {
      // Never throws to the session (FR-HIST-17): logging and notifying are already best effort.
    }
  }

  // ---- history:* ------------------------------------------------------------------------------------

  list(input: ValidListInput): HistoryListResult {
    const base = {
      retentionLabel: this.format.retentionLabel(this.retentionDays),
      unsavedCount: this.unsaved,
      unsavedLabel: this.unsaved > 0 ? historyStrings.unsaved(this.unsaved) : null,
    };
    const status = this.availability();
    if (status !== 'ok' || !this.deps.store) return { status, entries: [], nextCursor: null, ...base };
    const term = normalizeForSearch(input.query);
    // A search made only of punctuation or emoji ("?!", "🙂") matches nothing; an empty term would list it all.
    if (input.query !== '' && term === '') return { status: 'ok', entries: [], nextCursor: null, ...base };
    try {
      const page = this.deps.store.list({ term, after: input.after, limit: input.limit });
      this.format.syncTimeZone();
      const now = this.now();
      return {
        status: 'ok',
        entries: page.rows.map((row) => this.toEntry(row, now)),
        nextCursor: page.next ? encodeCursor(page.next) : null,
        ...base,
      };
    } catch (err) {
      this.deps.log.warn('history_read_failed', { name: historyErrorName(err) });
      return { status: 'unavailable', entries: [], nextCursor: null, ...base };
    }
  }

  copy(id: string): HistoryCopyResult {
    const store = this.deps.store;
    if (!store) return { result: 'unavailable' };
    let row: HistoryRow | null;
    try {
      row = store.get(id);
    } catch (err) {
      this.deps.log.warn('history_read_failed', { name: historyErrorName(err) });
      return { result: 'unavailable' };
    }
    if (!row) return { result: 'not_found' }; // the clipboard is not touched (FR-HIST-13)
    this.deps.clipboard.writeText(row.text);
    this.deps.log.info('history_copied');
    return { result: 'copied' };
  }

  remove(id: string): HistoryDeleteResult {
    const store = this.deps.store;
    if (!store) return { result: 'unavailable' };
    let removed: boolean;
    try {
      removed = store.remove(id);
    } catch (err) {
      this.deps.log.warn('history_write_failed', { session: null, name: historyErrorName(err) });
      return { result: 'unavailable' };
    }
    if (!removed) return { result: 'not_found' };
    this.deps.log.info('history_deleted');
    this.notify('deleted');
    return { result: 'deleted' };
  }

  clear(): HistoryClearResult {
    const store = this.deps.store;
    if (!store) return { result: 'unavailable', count: 0 };
    let count: number;
    try {
      count = store.clear();
    } catch (err) {
      this.deps.log.warn('history_write_failed', { session: null, name: historyErrorName(err) });
      return { result: 'unavailable', count: 0 };
    }
    this.deps.log.info('history_cleared', { count });
    this.notify('cleared');
    return { result: 'cleared', count };
  }

  getRetention(): HistoryRetentionView {
    return { retentionDays: this.retentionDays, retentionLabel: this.format.retentionLabel(this.retentionDays) };
  }

  /**
   * FR-HIST-20, FR-HIST-21: writes only history.retentionDays through the config.json queue; on success the
   * new value is used at once, with the purge of FR-HIST-07 and history:changed when something went. A file
   * that is not a JSON object, or a failed write, keeps the retention in use and answers write_failed.
   */
  async setRetention(retentionDays: RetentionDays): Promise<HistorySetRetentionResult> {
    const written = await this.deps.writer.update((raw) => withRetention(raw, retentionDays));
    if (!written.ok) {
      this.deps.log.error('config_write_failed', { name: written.name });
      return { result: 'write_failed', retentionDays: this.retentionDays, purged: 0, savedLabel: null };
    }
    this.retentionDays = retentionDays;
    let purged = 0;
    if (this.deps.store) {
      try {
        purged = this.deps.store.purge(retentionCutoff(retentionDays, this.now()));
      } catch (err) {
        this.deps.log.warn('history_purge_failed', { name: historyErrorName(err) });
      }
    }
    this.deps.log.info('history_retention_changed', { retention_days: retentionDays, purged });
    if (purged > 0) this.notify('purged');
    return { result: 'saved', retentionDays, purged, savedLabel: historyStrings.saved(purged) };
  }

  /**
   * history:stats (FR-HIST-22…24): totals of today (local day) and of the whole history, and the average words
   * per minute — computed here, in main; the answer carries numbers and labels, never a text.
   */
  stats(): HistoryStatsView {
    const retentionLabel = this.format.retentionLabel(this.retentionDays);
    const zero = { words: 0, dictations: 0, audioMs: 0 };
    const status = this.availability();
    const view = (today: typeof zero, all: typeof zero, wpmWords: number, wpmMs: number, s: HistoryAvailability): HistoryStatsView => {
      const wpm = wordsPerMinute(wpmWords, wpmMs);
      return {
        status: s,
        today: this.totals(today),
        allTime: this.totals(all),
        wordsPerMinute: wpm,
        wordsPerMinuteLabel: wpm === null ? historyStrings.noValue : this.format.count(wpm),
        retentionLabel,
      };
    };
    if (status !== 'ok' || !this.deps.store) return view(zero, zero, 0, 0, status);

    const now = this.now();
    const recentFrom = new Date(now - RECENT_WINDOW_MS).toISOString();
    const today = { ...zero };
    const all = { ...zero };
    let wpmWords = 0;
    let wpmMs = 0;
    try {
      this.format.syncTimeZone();
      const todayKey = this.format.dayKey(now);
      this.deps.store.scan(null, (row) => {
        const words = countWords(row.text);
        all.dictations += 1;
        all.words += words;
        all.audioMs += row.audioMs;
        if (row.audioMs > 0) {
          wpmWords += words;
          wpmMs += row.audioMs;
        }
        if (row.createdAt >= recentFrom && this.format.dayKey(Date.parse(row.createdAt)) === todayKey) {
          today.dictations += 1;
          today.words += words;
          today.audioMs += row.audioMs;
        }
      });
    } catch (err) {
      this.deps.log.warn('history_read_failed', { name: historyErrorName(err) });
      return view(zero, zero, 0, 0, 'unavailable');
    }
    return view(today, all, wpmWords, wpmMs, 'ok');
  }

  close(): void {
    try {
      this.deps.store?.close();
    } catch {
      // Closing at quit is best effort; the WAL is recovered on the next open.
    }
  }

  // ---- Helpers --------------------------------------------------------------------------------------

  private availability(): HistoryAvailability {
    if (!this.deps.store) return 'unavailable';
    return this.retentionDays === 0 ? 'disabled' : 'ok';
  }

  private totals(t: { words: number; dictations: number; audioMs: number }): HistoryTotals {
    return {
      words: t.words,
      dictations: t.dictations,
      spokenMs: t.audioMs,
      wordsLabel: this.format.count(t.words),
      dictationsLabel: this.format.count(t.dictations),
      spokenLabel: this.format.spokenLabel(t.audioMs),
    };
  }

  private toEntry(row: HistoryRow, now: number): HistoryEntry {
    const ms = Date.parse(row.createdAt);
    const dayLabel = this.format.dayLabel(ms, now);
    const timeLabel = this.format.timeLabel(ms);
    return {
      id: row.id,
      text: row.text,
      createdAt: row.createdAt,
      dayKey: this.format.dayKey(ms),
      dayLabel,
      timeLabel,
      durationLabel: this.format.durationLabel(row.audioMs),
      status: row.status,
      statusLabel: this.format.statusLabel(row.status),
      copyLabel: historyStrings.copyEntry(dayLabel, timeLabel),
      deleteLabel: historyStrings.deleteEntry(dayLabel, timeLabel),
    };
  }

  private notify(reason: HistoryChangeReason): void {
    try {
      this.deps.notify(reason);
    } catch {
      // The window may be closing; the screen reloads when it opens again.
    }
  }
}
