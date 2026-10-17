// config.json in the user data folder (docs/DATABASE.md). Invalid fields fall back to defaults;
// a bad config must never stop the app from starting.
import * as fs from 'node:fs';
import * as path from 'node:path';
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
};

const MODELS = ['whisper-large-v3-turbo', 'whisper-large-v3'];

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

  return config;
}

/** Reads config.json from `dir`, creating it with defaults on first run. */
export function loadConfig(dir: string, warn: Warn): AppConfig {
  const file = path.join(dir, 'config.json');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf8');
    return structuredClone(DEFAULT_CONFIG);
  }
  try {
    return normalizeConfig(JSON.parse(fs.readFileSync(file, 'utf8')), warn);
  } catch {
    warn('json');
    return structuredClone(DEFAULT_CONFIG);
  }
}
