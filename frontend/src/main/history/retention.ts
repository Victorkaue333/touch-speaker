// The history retention (spec historico FR-HIST-06, FR-HIST-07; config.json history.retentionDays):
// 0 = never store (and everything goes), 1 to 3650 days, null = forever. Pure (TEST-010).
import type { RetentionDays } from '../../shared/ipc';

export const DEFAULT_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isRetentionDays(value: unknown): value is RetentionDays {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_RETENTION_DAYS);
}

/** What a purge removes: nothing, everything, or the entries created before an instant (ISO-8601 UTC). */
export type RetentionCutoff = { kind: 'none' } | { kind: 'all' } | { kind: 'before'; iso: string };

export function retentionCutoff(days: RetentionDays, nowMs: number): RetentionCutoff {
  if (days === null) return { kind: 'none' };
  if (days === 0) return { kind: 'all' };
  return { kind: 'before', iso: new Date(nowMs - days * DAY_MS).toISOString() };
}
