// Validation of the history:* payloads (spec historico §10, FR-HIST-19): the renderer is untrusted. Exactly the
// keys of §10 with the right types and limits, or the message is dropped (ipc_rejected) without touching the
// database, the clipboard or config.json. The sender check is the main window's (main-window-ipc.ts, FR-UI-33).
// Channels without payload (history:get-retention, history:stats) accept no argument at all (isEmptyPayload).
// The cursor is opaque to the screen; its format is the one main itself produces here. Pure (TEST-013).
import type { RetentionDays } from '../../shared/ipc';
import { isPlainRecord } from '../main-window-ipc';
import { isRetentionDays } from './retention';

export const MAX_QUERY_LENGTH = 200;
export const MAX_CURSOR_LENGTH = 128;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_UTC_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isEntryId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}

/** Where a page ends: the last entry, in list order (created_at DESC, id DESC). */
export interface PagePosition {
  createdAt: string;
  id: string;
}

export function encodeCursor(position: PagePosition): string {
  return `${position.createdAt}~${position.id}`;
}

export function decodeCursor(cursor: string): PagePosition | null {
  if (cursor.length > MAX_CURSOR_LENGTH) return null;
  const at = cursor.indexOf('~');
  if (at < 0) return null;
  const createdAt = cursor.slice(0, at);
  const id = cursor.slice(at + 1);
  return ISO_UTC_MS.test(createdAt) && isEntryId(id) ? { createdAt, id } : null;
}

export interface ValidListInput {
  /** Trimmed; '' = no search. */
  query: string;
  after: PagePosition | null;
  limit: number;
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/** history:list — `{ query?, cursor?, limit? }` and nothing else. */
export function asHistoryListInput(args: readonly unknown[]): ValidListInput | null {
  const [payload] = args;
  if (args.length !== 1 || !isPlainRecord(payload) || !onlyKeys(payload, ['query', 'cursor', 'limit'])) return null;
  const { query, cursor, limit } = payload;

  let term = '';
  if (query !== undefined) {
    if (typeof query !== 'string') return null;
    term = query.trim();
    if (term.length > MAX_QUERY_LENGTH) return null;
  }

  let after: PagePosition | null = null;
  if (cursor !== undefined && cursor !== null) {
    if (typeof cursor !== 'string') return null;
    after = decodeCursor(cursor);
    if (!after) return null;
  }

  let size = DEFAULT_PAGE_SIZE;
  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) return null;
    size = limit;
  }
  return { query: term, after, limit: size };
}

/** history:copy and history:delete — `{ id }`, a UUID v4. */
export function asHistoryIdInput(args: readonly unknown[]): string | null {
  const [payload] = args;
  if (args.length !== 1 || !isPlainRecord(payload) || Object.keys(payload).length !== 1) return null;
  return isEntryId(payload.id) ? payload.id : null;
}

/** history:clear — `{ confirmed: true }`, exactly: a second lock besides the confirmation on screen. */
export function asHistoryClearInput(args: readonly unknown[]): boolean {
  const [payload] = args;
  return args.length === 1 && isPlainRecord(payload) && Object.keys(payload).length === 1 && payload.confirmed === true;
}

/** history:set-retention — `{ retentionDays }`, an integer 0 to 3650 or null. */
export function asRetentionInput(args: readonly unknown[]): { retentionDays: RetentionDays } | null {
  const [payload] = args;
  if (args.length !== 1 || !isPlainRecord(payload) || Object.keys(payload).length !== 1) return null;
  if (!Object.hasOwn(payload, 'retentionDays')) return null;
  return isRetentionDays(payload.retentionDays) ? { retentionDays: payload.retentionDays } : null;
}
