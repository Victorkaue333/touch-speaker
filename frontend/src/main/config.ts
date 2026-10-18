// config.json in the user data folder (docs/DATABASE.md). Invalid fields fall back to defaults;
// a bad config must never stop the app from starting.
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RetentionDays, TranscriptionModel } from '../shared/ipc';
import { isThemePreference, type ThemePreference } from '../shared/theme';
import { errorName, type FilePort, nodeFilePort, writeFileAtomic } from './atomic-file';
import { DEFAULT_RETENTION_DAYS, isRetentionDays } from './history/retention';
import { type HotkeyName, isHotkeyName } from './keys';

export interface AppConfig {
  version: 1;
  hotkey: HotkeyName;
  holdThresholdMs: number;
  maxRecordingMs: number;
  language: string;
  transcription: { provider: 'groq'; model: string };
  microphoneDeviceId: string | null;
  pill: { position: 'bottom-center' | 'top-center' };
  sounds: boolean;
  /**
   * Spec historico §9 / historico-dados-v1: 0 = never store, 1–3650 days, null = forever. An additive field
   * with a default: a config.json without it means 30 days, and `version` stays 1 (historico-dados-v1 §6.6).
   */
  history: { retentionDays: RetentionDays };
  /**
   * Spec janela-principal FR-UI-39…42 (Victor, 18/out/2026): "system" (default) follows the OS; "light" or
   * "dark" is the person's choice, applied with nativeTheme.themeSource. Additive, like history: version stays 1.
   */
  theme: ThemePreference;
}

export const MAX_RECORDING_MS = 5 * 60 * 1000;

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  hotkey: 'RightCtrl',
  holdThresholdMs: 500,
  maxRecordingMs: MAX_RECORDING_MS,
  language: 'pt',
  transcription: { provider: 'groq', model: 'whisper-large-v3-turbo' },
  microphoneDeviceId: null,
  pill: { position: 'bottom-center' },
  sounds: true,
  history: { retentionDays: DEFAULT_RETENTION_DAYS },
  theme: 'system',
};

export const TRANSCRIPTION_MODELS: readonly TranscriptionModel[] = ['whisper-large-v3-turbo', 'whisper-large-v3'];
const MODELS: readonly string[] = TRANSCRIPTION_MODELS;

type Warn = (field: string) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function intInRange(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

/** Validates a parsed config.json, replacing each invalid or missing field with its default. */
export function normalizeConfig(raw: unknown, warn: Warn): AppConfig {
  const config: AppConfig = structuredClone(DEFAULT_CONFIG);
  if (!isRecord(raw)) {
    warn('root');
    return config;
  }

  const pick = <T>(field: string, value: T | undefined, apply: (v: T) => void): void => {
    if (raw[field] === undefined) return;
    if (value === undefined) warn(field);
    else apply(value);
  };

  pick('hotkey', isHotkeyName(raw.hotkey) ? raw.hotkey : undefined, (v) => (config.hotkey = v));
  pick('holdThresholdMs', intInRange(raw.holdThresholdMs, 200, 1500), (v) => (config.holdThresholdMs = v));
  pick('maxRecordingMs', intInRange(raw.maxRecordingMs, 10_000, MAX_RECORDING_MS), (v) => (config.maxRecordingMs = v));
  pick(
    'language',
    typeof raw.language === 'string' && /^[a-z]{2}$/.test(raw.language) ? raw.language : undefined,
    (v) => (config.language = v),
  );
  pick(
    'microphoneDeviceId',
    raw.microphoneDeviceId === null || typeof raw.microphoneDeviceId === 'string' ? raw.microphoneDeviceId : undefined,
    (v) => (config.microphoneDeviceId = v),
  );
  pick('sounds', typeof raw.sounds === 'boolean' ? raw.sounds : undefined, (v) => (config.sounds = v));
  pick('theme', isThemePreference(raw.theme) ? raw.theme : undefined, (v) => (config.theme = v));

  if (raw.transcription !== undefined) {
    const t = raw.transcription;
    if (isRecord(t) && (t.provider === undefined || t.provider === 'groq') && (t.model === undefined || MODELS.includes(t.model as string))) {
      if (typeof t.model === 'string') config.transcription.model = t.model;
    } else {
      warn('transcription');
    }
  }

  if (raw.pill !== undefined) {
    const p = raw.pill;
    if (isRecord(p) && (p.position === 'bottom-center' || p.position === 'top-center')) config.pill.position = p.position;
    else warn('pill');
  }

  // null is a valid value here ("para sempre"), so this one does not go through pick/intInRange.
  if (raw.history !== undefined) {
    const h = raw.history;
    if (isRecord(h) && (h.retentionDays === undefined || isRetentionDays(h.retentionDays))) {
      if (h.retentionDays !== undefined) config.history.retentionDays = h.retentionDays;
    } else {
      warn('history');
    }
  }

  return config;
}

/**
 * The single-field rewrite of the history retention (spec historico FR-HIST-20, D13; historico-dados-v1):
 * only history.retentionDays changes — other keys inside `history`, every other field, unknown fields and
 * `version` stay as they were. Runs inside ConfigWriter.update, which re-reads the file first.
 */
export function withRetention(raw: RawConfig, retentionDays: RetentionDays): RawConfig {
  const history = isRecord(raw.history) ? raw.history : {};
  return { ...raw, history: { ...history, retentionDays } };
}

/** The single-field rewrite of the theme (janela-principal FR-UI-40): only `theme` changes. */
export function withTheme(raw: RawConfig, theme: ThemePreference): RawConfig {
  return { ...raw, theme };
}

export interface LoadedConfig {
  config: AppConfig;
  /** config.json did not exist and was created now: the first-run signal (spec janela-principal FR-UI-35). */
  created: boolean;
}

/** Reads config.json from `dir`, creating it with defaults on first run. */
export function loadConfig(dir: string, warn: Warn): LoadedConfig {
  const file = configFile(dir);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf8');
    return { config: structuredClone(DEFAULT_CONFIG), created: true };
  }
  try {
    return { config: normalizeConfig(JSON.parse(fs.readFileSync(file, 'utf8')), warn), created: false };
  } catch {
    warn('json');
    return { config: structuredClone(DEFAULT_CONFIG), created: false };
  }
}

export function configFile(dir: string): string {
  return path.join(dir, 'config.json');
}

// ---- Writing config.json from the screens (spec janela-principal FR-UI-29) --------------------------

export type RawConfig = Record<string, unknown>;

export type RawConfigRead = { kind: 'missing' } | { kind: 'invalid' } | { kind: 'ok'; raw: RawConfig };

/** Reads config.json as raw JSON, keeping unknown fields; never warns (the warning belongs to startup). */
export function readRawConfig(dir: string, files: FilePort = nodeFilePort): RawConfigRead {
  const file = configFile(dir);
  if (!files.existsSync(file)) return { kind: 'missing' };
  try {
    const raw: unknown = JSON.parse(files.readFileSync(file).toString('utf8'));
    return isRecord(raw) ? { kind: 'ok', raw } : { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
}

/** config.json on disk, normalized, without logging config_invalid_field (FR-UI-26). */
export function readConfigQuietly(dir: string, files: FilePort = nodeFilePort): AppConfig {
  const read = readRawConfig(dir, files);
  return read.kind === 'ok' ? normalizeConfig(read.raw, () => {}) : structuredClone(DEFAULT_CONFIG);
}

export type ConfigUpdateResult = { ok: true } | { ok: false; reason: 'invalid_json' | 'write_failed'; name: string };

/**
 * The single write queue of config.json. Every writer (the preferences of the main window; the history
 * retention of spec historico, FR-HIST-20, through withRetention) goes through `update`, one at a time: each run re-reads the
 * file, changes only its own fields and writes atomically, so no writer erases another (FR-UI-29). A file that
 * is not a JSON object is never overwritten (same rule as FR-HIST-21); a missing file is recreated from the
 * defaults.
 */
export class ConfigWriter {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly dir: string,
    private readonly files: FilePort = nodeFilePort,
  ) {}

  update(mutate: (raw: RawConfig) => RawConfig): Promise<ConfigUpdateResult> {
    const run = (): ConfigUpdateResult => this.apply(mutate);
    const result = this.tail.then(run, run);
    this.tail = result;
    return result;
  }

  private apply(mutate: (raw: RawConfig) => RawConfig): ConfigUpdateResult {
    const read = readRawConfig(this.dir, this.files);
    if (read.kind === 'invalid') return { ok: false, reason: 'invalid_json', name: 'invalid_json' };
    const base: RawConfig = read.kind === 'ok' ? read.raw : (structuredClone(DEFAULT_CONFIG) as unknown as RawConfig);
    try {
      const next = mutate(base);
      this.files.mkdirSync(this.dir);
      writeFileAtomic(configFile(this.dir), JSON.stringify(next, null, 2) + '\n', this.files);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: 'write_failed', name: errorName(err) };
    }
  }
}
