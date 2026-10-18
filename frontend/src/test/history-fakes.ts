// Shared fakes of the history tests (not a test file: no `.test.` in the name).
import * as path from 'node:path';
import type { LogFields, LogPort } from '../main/logger';
import { readMigrations } from '../main/history/migrations';
import { type HistoryStore, openSqliteHistory } from '../main/history/store';

export const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'local');

export interface LogLine {
  level: 'info' | 'warn' | 'error';
  event: string;
  fields: LogFields;
}

/** A Logger that keeps every line, to check order and that no dictated text ever reaches the log (C1). */
export class RecordingLog implements LogPort {
  readonly lines: LogLine[] = [];
  constructor(private readonly onLine?: (line: LogLine) => void) {}
  info(event: string, fields: LogFields = {}): void {
    this.push({ level: 'info', event, fields });
  }
  warn(event: string, fields: LogFields = {}): void {
    this.push({ level: 'warn', event, fields });
  }
  error(event: string, fields: LogFields = {}): void {
    this.push({ level: 'error', event, fields });
  }
  events(): string[] {
    return this.lines.map((l) => l.event);
  }
  /** Everything that went to the log, as one string. */
  dump(): string {
    return JSON.stringify(this.lines);
  }
  private push(line: LogLine): void {
    this.lines.push(line);
    this.onLine?.(line);
  }
}

/** A real SQLite history in memory (node:sqlite, ADR-09), with migration 0001 applied. */
export function memoryStore(nowIso: () => string = () => new Date().toISOString()): HistoryStore {
  return openSqliteHistory({ file: ':memory:', migrations: readMigrations(MIGRATIONS_DIR), nowIso });
}

/** The same store, with save throwing — a full disk, a locked file (FR-HIST-17). */
export function failingSaves(store: HistoryStore): HistoryStore {
  return {
    get schemaVersion() {
      return store.schemaVersion;
    },
    save: () => {
      throw Object.assign(new Error('database or disk is full'), { code: 'ERR_SQLITE_ERROR', errcode: 13 });
    },
    list: (q) => store.list(q),
    get: (id) => store.get(id),
    remove: (id) => store.remove(id),
    clear: () => store.clear(),
    purge: (c) => store.purge(c),
    count: () => store.count(),
    scan: (since, visit) => store.scan(since, visit),
    close: () => store.close(),
  };
}
