// The preferences of the Configurações screen (spec janela-principal FR-UI-26…31): the seven config.json
// fields that already exist, read from disk each time the screen shows, validated with the same rules as
// normalizeConfig, written through the single config.json queue (ConfigWriter) changing only those seven
// fields. What the app uses does not change until a restart (FR-DICT-13, FR-UI-31).
// No `electron` import (TEST-008).
import {
  EDITABLE_SETTINGS_KEYS,
  type EditableSettings,
  type GroqKeyState,
  type SettingsResult,
  type TranscriptionModel,
} from '../shared/ipc';
import { type FilePort, nodeFilePort } from './atomic-file';
import { type AppConfig, type ConfigWriter, normalizeConfig, type RawConfig, readConfigQuietly } from './config';

/** The editable view of a config. */
export function toEditable(config: AppConfig): EditableSettings {
  return {
    hotkey: config.hotkey,
    holdThresholdMs: config.holdThresholdMs,
    maxRecordingMs: config.maxRecordingMs,
    language: config.language,
    model: config.transcription.model as TranscriptionModel, // normalizeConfig only keeps the two models
    pillPosition: config.pill.position,
    sounds: config.sounds,
  };
}

/** normalizeConfig warns with the config.json field; the screen names its own field. */
const FIELD_FOR_WARNING: Readonly<Record<string, keyof EditableSettings>> = {
  hotkey: 'hotkey',
  holdThresholdMs: 'holdThresholdMs',
  maxRecordingMs: 'maxRecordingMs',
  language: 'language',
  transcription: 'model',
  pill: 'pillPosition',
  sounds: 'sounds',
};

/** settings:save as it arrives from the screen: the right shape and types, values not yet checked. */
export type SettingsInput = Omit<EditableSettings, 'hotkey' | 'model' | 'pillPosition'> & {
  hotkey: string;
  model: string;
  pillPosition: string;
};

export type SettingsValidation = { ok: true; values: EditableSettings } | { ok: false; field: keyof EditableSettings };

/** Validates the screen values with the rules of normalizeConfig (BR-012), without duplicating them (FR-UI-28). */
export function validateSettings(input: SettingsInput): SettingsValidation {
  const warned: string[] = [];
  const config = normalizeConfig(
    {
      hotkey: input.hotkey,
      holdThresholdMs: input.holdThresholdMs,
      maxRecordingMs: input.maxRecordingMs,
      language: input.language,
      transcription: { provider: 'groq', model: input.model },
      pill: { position: input.pillPosition },
      sounds: input.sounds,
    },
    (field) => warned.push(field),
  );
  const first = warned[0];
  if (first !== undefined) return { ok: false, field: FIELD_FOR_WARNING[first] ?? 'hotkey' };
  return { ok: true, values: toEditable(config) };
}

export function sameSettings(a: EditableSettings, b: EditableSettings): boolean {
  return EDITABLE_SETTINGS_KEYS.every((key) => a[key] === b[key]);
}

export function changedFields(before: EditableSettings, after: EditableSettings): (keyof EditableSettings)[] {
  return EDITABLE_SETTINGS_KEYS.filter((key) => before[key] !== after[key]);
}

function asRecord(value: unknown): RawConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RawConfig) : {};
}

/**
 * Puts the seven fields into the raw config.json, keeping everything else as it was: version,
 * transcription.provider, microphoneDeviceId, history.retentionDays (written only by spec historico), fields
 * of sister specs and unknown fields (FR-UI-29).
 */
export function mergeSettings(raw: RawConfig, values: EditableSettings): RawConfig {
  const transcription = asRecord(raw.transcription);
  const pill = asRecord(raw.pill);
  return {
    ...raw,
    hotkey: values.hotkey,
    holdThresholdMs: values.holdThresholdMs,
    maxRecordingMs: values.maxRecordingMs,
    language: values.language,
    transcription: { provider: 'groq', ...transcription, model: values.model },
    pill: { ...pill, position: values.pillPosition },
    sounds: values.sounds,
  };
}

/** FR-UI-35: the window opens by itself only when config.json was created now and no key is stored. */
export function shouldOpenOnFirstRun(configCreated: boolean, keyState: GroqKeyState): boolean {
  return configCreated && keyState !== 'stored';
}

export interface SettingsRead {
  values: EditableSettings;
  restartPending: boolean;
}

/** The answer for the screen plus what the log needs (names of changed fields, error name — never values). */
export type SettingsSaveOutcome =
  | { kind: 'saved'; result: SettingsResult; fields: (keyof EditableSettings)[] }
  | { kind: 'invalid_field'; result: SettingsResult; field: keyof EditableSettings }
  | { kind: 'write_failed'; result: SettingsResult; name: string };

export interface SettingsStoreOptions {
  dir: string;
  /** The config read at startup — what the app is using until a restart. */
  inUse: AppConfig;
  writer: ConfigWriter;
  files?: FilePort;
}

export class SettingsStore {
  private readonly inUse: EditableSettings;
  private readonly files: FilePort;

  constructor(private readonly opts: SettingsStoreOptions) {
    this.inUse = toEditable(opts.inUse);
    this.files = opts.files ?? nodeFilePort;
  }

  /** Values on disk now, normalized and quiet (FR-UI-26), and whether they differ from the ones in use (FR-UI-31). */
  read(): SettingsRead {
    const values = toEditable(readConfigQuietly(this.opts.dir, this.files));
    return { values, restartPending: !sameSettings(values, this.inUse) };
  }

  /** Validates everything first; any invalid field refuses the whole save and writes nothing (FR-UI-28). */
  async save(input: SettingsInput): Promise<SettingsSaveOutcome> {
    const valid = validateSettings(input);
    if (!valid.ok) {
      return { kind: 'invalid_field', result: { ok: false, code: 'invalid_field', field: valid.field }, field: valid.field };
    }
    const seen: { before?: EditableSettings } = {};
    const written = await this.opts.writer.update((raw) => {
      seen.before = toEditable(normalizeConfig(raw, () => {}));
      return mergeSettings(raw, valid.values);
    });
    if (!written.ok) return { kind: 'write_failed', result: { ok: false, code: 'write_failed' }, name: written.name };
    return {
      kind: 'saved',
      result: { ok: true, restartPending: !sameSettings(valid.values, this.inUse) },
      fields: seen.before ? changedFields(seen.before, valid.values) : [...EDITABLE_SETTINGS_KEYS],
    };
  }
}
