// Migrations of the local database (docs/DATABASE.md "Migrations", spec historico-dados-v1): numbered files
// database/local/NNNN_description.sql, forward only, the pending ones applied on open, each in its own
// transaction, recorded in schema_migrations. A database already past the newest migration this app knows
// (opened by a newer version) is left untouched and the history is unavailable (historico-dados-v1 FR-HIST-28).
// With store.ts, the only file that touches the driver (ADR-09) — and only through its types.
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const FILE_NAME = /^(\d{4})_([a-z0-9_]+)\.sql$/;

/** The migrations of `dir`, in version order. A missing folder or a repeated number is an error. */
export function readMigrations(dir: string): Migration[] {
  const migrations: Migration[] = [];
  for (const file of fs.readdirSync(dir)) {
    const match = FILE_NAME.exec(file);
    if (!match) continue;
    migrations.push({ version: Number(match[1]), name: match[2] ?? '', sql: fs.readFileSync(path.join(dir, file), 'utf8') });
  }
  migrations.sort((a, b) => a.version - b.version);
  for (let i = 1; i < migrations.length; i++) {
    if (migrations[i]?.version === migrations[i - 1]?.version) throw migrationError('migration_duplicated');
  }
  if (migrations.length === 0) throw migrationError('migrations_missing');
  return migrations;
}

export function migrationError(name: string): Error {
  const err = new Error(name);
  err.name = name;
  return err;
}

export interface MigrationOutcome {
  /** Version of the schema after opening. */
  version: number;
  /** Migrations applied now. */
  applied: number;
}

/** Applies the pending migrations, each in a transaction; on failure nothing of that migration stays. */
export function applyMigrations(db: DatabaseSync, migrations: readonly Migration[], nowIso: () => string): MigrationOutcome {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number | null } | undefined;
  let current = Number(row?.version ?? 0);
  const newest = migrations.at(-1)?.version ?? 0;
  if (current > newest) throw migrationError('schema_too_new');

  let applied = 0;
  const record = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      record.run(migration.version, nowIso());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    current = migration.version;
    applied++;
  }
  return { version: current, applied };
}
