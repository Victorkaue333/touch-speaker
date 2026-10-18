// Validation of the IPC of the main window (spec janela-principal FR-UI-33, §10): the renderer is
// untrusted. A message is accepted only from the main window that is open, from its top frame, loaded from
// the app's own index.html, and only with the exact payload shape of §10; anything else is dropped and
// logged as ipc_rejected. Same style as asStarted / asResult of the pill (src/main/index.ts).
// No `electron` import (TEST-009).
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITABLE_SETTINGS_KEYS } from '../shared/ipc';
import { isThemePreference, type ThemePreference } from '../shared/theme';
import { normalizeGroqKey } from './credentials';
import type { SettingsInput } from './settings';

/** Longest string accepted in a settings field before validation; real values are a few characters. */
const MAX_SETTINGS_STRING = 64;

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

const shortString = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_SETTINGS_STRING;

/** Channels without payload accept no argument at all. */
export function isEmptyPayload(args: readonly unknown[]): boolean {
  return args.length === 0;
}

export type GroqKeyInput = { kind: 'rejected' } | { kind: 'invalid_format' } | { kind: 'ok'; key: string };

/**
 * groq-key:set — `{ key: string }` and nothing else, or the message is dropped (ipc_rejected); then the
 * format of FR-UI-19 (invalid_format). The key is never logged, whatever happens.
 */
export function asGroqKeyInput(args: readonly unknown[]): GroqKeyInput {
  const [payload] = args;
  if (args.length !== 1 || !isPlainRecord(payload) || !hasExactKeys(payload, ['key']) || typeof payload.key !== 'string') {
    return { kind: 'rejected' };
  }
  const key = normalizeGroqKey(payload.key);
  return key === null ? { kind: 'invalid_format' } : { kind: 'ok', key };
}

/**
 * settings:save — exactly the seven keys of FR-UI-26 with the right types, or the message is dropped
 * (ipc_rejected) — including any attempt to send the history retention through here. Values out of range
 * are not checked here: they become invalid_field in SettingsStore.
 */
export function asSettingsInput(args: readonly unknown[]): SettingsInput | null {
  const [payload] = args;
  if (args.length !== 1 || !isPlainRecord(payload) || !hasExactKeys(payload, EDITABLE_SETTINGS_KEYS)) return null;
  const { hotkey, holdThresholdMs, maxRecordingMs, language, model, pillPosition, sounds } = payload;
  if (!shortString(hotkey) || !shortString(language) || !shortString(model) || !shortString(pillPosition)) return null;
  if (typeof holdThresholdMs !== 'number' || typeof maxRecordingMs !== 'number' || typeof sounds !== 'boolean') return null;
  return { hotkey, holdThresholdMs, maxRecordingMs, language, model, pillPosition, sounds };
}

/** theme:set — `{ theme: 'system' | 'light' | 'dark' }` and nothing else (FR-UI-40). */
export function asThemeInput(args: readonly unknown[]): { theme: ThemePreference } | null {
  const [payload] = args;
  if (args.length !== 1 || !isPlainRecord(payload) || !hasExactKeys(payload, ['theme'])) return null;
  return isThemePreference(payload.theme) ? { theme: payload.theme } : null;
}

/** login-item:set — `{ enabled: boolean }` and nothing else. */
export function asLoginItemInput(args: readonly unknown[]): { enabled: boolean } | null {
  const [payload] = args;
  if (args.length !== 1 || !isPlainRecord(payload) || !hasExactKeys(payload, ['enabled'])) return null;
  return typeof payload.enabled === 'boolean' ? { enabled: payload.enabled } : null;
}

// ---- Sender -----------------------------------------------------------------------------------------

/** The part of an IPC event's senderFrame the check needs. */
export interface FrameIdentity {
  url: string;
  /** The frame has no parent: it is the page itself, not an iframe. */
  isTop: boolean;
}

function samePath(a: string, b: string, platform: NodeJS.Platform): boolean {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

/**
 * The URL is the app's own index.html of the main window: `file:`, no query, same path (case-insensitive on
 * Windows; the hash that opens Configurações on first run is allowed).
 */
export function isPageUrl(url: string, pageFile: string, platform: NodeJS.Platform = process.platform): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'file:' || parsed.search !== '' || parsed.host !== '') return false;
  parsed.hash = '';
  let file: string;
  try {
    file = fileURLToPath(parsed);
  } catch {
    return false;
  }
  return samePath(file, pageFile, platform);
}

/**
 * FR-UI-33: the sender is the webContents of the main window open right now (`current` is read at each
 * message, since the window is recreated), the message comes from its top frame, and that frame shows the
 * app's index.html. A closed window (`current` null) refuses everything.
 */
export function isMainWindowSender(
  sender: unknown,
  frame: FrameIdentity | null,
  current: unknown,
  pageFile: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (current === null || current === undefined || sender !== current) return false;
  if (!frame || !frame.isTop) return false;
  return isPageUrl(frame.url, pageFile, platform);
}
