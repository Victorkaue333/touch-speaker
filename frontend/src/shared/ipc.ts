// IPC contracts between the main process and its two renderers (docs/API.md, "Contratos"): the pill
// (recorder:*, pill:state) and the main window (app:*, settings:*, groq-key:*, login-item:*, history:*).
// The sandboxed preloads cannot require local modules, so src/preload/pill.ts and
// src/preload/main-window.ts keep their own copies of the channel names, and the classic-script renderers
// mirror the types in src/renderer/global.d.ts and src/renderer/main-window/global.d.ts. The three
// files of each pair change together (docs/Code-Style.md).
import type { HotkeyName } from '../main/keys';
import type { ThemePreference } from './theme';

export const Channel = {
  // ---- main ⇄ pill ----
  RecorderStart: 'recorder:start',
  RecorderStop: 'recorder:stop',
  RecorderCancel: 'recorder:cancel',
  PillState: 'pill:state',
  RecorderStarted: 'recorder:started',
  RecorderResult: 'recorder:result',
  RecorderError: 'recorder:error',
  // ---- main ⇄ main window (spec janela-principal §10) ----
  AppGetStrings: 'app:get-strings',
  AppGetStatus: 'app:get-status',
  AppStatus: 'app:status',
  SettingsGet: 'settings:get',
  SettingsSave: 'settings:save',
  GroqKeySet: 'groq-key:set',
  GroqKeyRemove: 'groq-key:remove',
  LoginItemSet: 'login-item:set',
  AppRelaunch: 'app:relaunch',
  // ---- main ⇄ main window, history (spec historico §10) ----
  HistoryList: 'history:list',
  HistoryCopy: 'history:copy',
  HistoryDelete: 'history:delete',
  HistoryClear: 'history:clear',
  HistoryGetRetention: 'history:get-retention',
  HistorySetRetention: 'history:set-retention',
  HistoryStats: 'history:stats',
  HistoryChanged: 'history:changed',
  // ---- main ⇄ main window, theme (spec janela-principal FR-UI-39…42) ----
  ThemeSet: 'theme:set',
} as const;

export type SessionMode = 'hold' | 'handsfree';

export type PillStateName = 'listening' | 'transcribing' | 'error' | 'notice' | 'hidden';

export interface PillState {
  state: PillStateName;
  mode: SessionMode;
  message?: string;
  hint?: string;
  /** Recording is close to the time limit. */
  warn?: boolean;
  sounds: boolean;
}

export interface RecorderStartPayload {
  sessionId: string;
  deviceId: string | null;
  maxMs: number;
  sounds: boolean;
}

export interface SessionRef {
  sessionId: string;
}

export interface RecorderStartedPayload {
  sessionId: string;
  startedAt: number;
}

export interface RecorderResultPayload {
  sessionId: string;
  audio: ArrayBuffer;
  mimeType: string;
  durationMs: number;
}

export type RecorderErrorCode = 'mic_denied' | 'mic_unavailable' | 'recorder_failed';

export interface RecorderErrorPayload {
  sessionId: string;
  code: RecorderErrorCode;
  detail?: string;
}

// ---- Main window (spec janela-principal §10) -------------------------------------------------------

/** Where the Groq key in use comes from. The key itself never crosses IPC (FR-UI-22). */
export type GroqKeyState = 'stored' | 'env' | 'none' | 'unreadable';

export type TranscriptionModel = 'whisper-large-v3-turbo' | 'whisper-large-v3';
export type PillPosition = 'bottom-center' | 'top-center';
export type MicrophoneSource = 'default' | 'custom';

export interface AppStatus {
  groqKey: GroqKeyState;
  encryptionAvailable: boolean;
  /** startKeyboardHook loaded. */
  keyboardHook: boolean;
  /** From SessionController.onRecordingChange. */
  recording: boolean;
  /** In use (read at startup). */
  hotkey: HotkeyName;
  /** In use (read at startup). */
  holdThresholdMs: number;
  /** "Como ditar" lines, built in main with the hotkey and threshold in use. */
  howTo: string[];
  microphone: MicrophoneSource;
  /** The theme choice in use (config.json `theme`; FR-UI-39). The renderer resolves "system" itself. */
  theme: ThemePreference;
}

/** theme:set — main writes config.json `theme` and applies it with nativeTheme.themeSource (FR-UI-40). */
export type ThemeResult = { ok: true; theme: ThemePreference } | { ok: false; code: 'write_failed'; theme: ThemePreference };

/** The seven config.json fields the Configurações screen edits (FR-UI-26). */
export interface EditableSettings {
  hotkey: HotkeyName;
  /** Integer, 200 to 1500. */
  holdThresholdMs: number;
  /** Integer, 10000 to 300000 (the screen shows seconds; the contract is in ms). */
  maxRecordingMs: number;
  /** ^[a-z]{2}$ */
  language: string;
  model: TranscriptionModel;
  pillPosition: PillPosition;
  sounds: boolean;
}

export const EDITABLE_SETTINGS_KEYS = [
  'hotkey',
  'holdThresholdMs',
  'maxRecordingMs',
  'language',
  'model',
  'pillPosition',
  'sounds',
] as const satisfies readonly (keyof EditableSettings)[];

export interface LoginItemView {
  /** false while the app runs unpackaged (npm run dev) — FR-UI-37. */
  available: boolean;
  enabled: boolean;
}

export interface SettingsView {
  /** From config.json on disk, normalized. */
  values: EditableSettings;
  /** Disk differs from what the app is using. */
  restartPending: boolean;
  /** The 16 names of HOTKEY_CODES, for the list on screen. */
  hotkeys: HotkeyName[];
  /** Read only (FR-UI-27). */
  microphone: MicrophoneSource;
  loginItem: LoginItemView;
  // The history retention is not here: it comes from history:get-retention (spec historico §10).
}

export type SettingsResult =
  | { ok: true; restartPending: boolean }
  | { ok: false; code: 'invalid_field'; field: keyof EditableSettings }
  | { ok: false; code: 'write_failed' };

export type LoginItemResult =
  | { ok: true; enabled: boolean }
  | { ok: false; code: 'unavailable' | 'login_item_failed'; enabled: boolean };

export type GroqKeyResult =
  | { ok: true; state: GroqKeyState }
  | { ok: false; code: 'invalid_format' | 'encryption_unavailable' | 'write_failed' };

/**
 * Error codes of the main window. They never reach the pill, so they stay out of ErrorCode
 * (src/main/errors.ts); messages in strings.ts, table in docs/API.md.
 */
export type MainWindowErrorCode =
  | 'invalid_format'
  | 'encryption_unavailable'
  | 'write_failed'
  | 'invalid_field'
  | 'unavailable'
  | 'login_item_failed';

/**
 * The texts of the main window, from strings.ts. Plain strings only: functions do not survive the
 * structured clone of IPC, so texts with values arrive ready in AppStatus.howTo.
 */
export interface MainWindowStrings {
  appName: string;
  navHome: string;
  navHistory: string;
  navDictionary: string;
  navSettings: string;
  navSoon: string;
  homeHowTo: string;
  homeHotkey: string;
  homeState: string;
  homeKey: string;
  stateReady: string;
  stateListening: string;
  stateNoKey: string;
  stateHookDown: string;
  keyStored: string;
  keyEnv: string;
  keyNone: string;
  keyUnreadable: string;
  keyStateLabel: string;
  keyField: string;
  keyConfigure: string;
  keySave: string;
  keyRemove: string;
  keyConfirmRemove: string;
  keyCancel: string;
  keySaved: string;
  keyRemoved: string;
  keyHelp: string;
  settingsPreferences: string;
  settingsSave: string;
  settingsSaved: string;
  settingsRestartPending: string;
  settingsRestartNow: string;
  fieldLabels: Record<keyof EditableSettings, string>;
  holdThresholdRange: string;
  maxRecordingRange: string;
  hotkeyNames: Record<HotkeyName, string>;
  pillPositions: Record<PillPosition, string>;
  models: Record<TranscriptionModel, string>;
  micDefault: string;
  micCustom: string;
  loginTitle: string;
  loginItem: string;
  loginItemDevOnly: string;
  loginItemFailed: string;
  errors: {
    invalidFormat: string;
    encryptionUnavailable: string;
    keyWriteFailed: string;
    invalidField: string;
    settingsWriteFailed: string;
  };
  dictionarySoon: string;
  history: HistoryStrings;
  retention: RetentionStrings;
  home: HomeHistoryStrings;
  theme: ThemeStrings;
}

/** The theme toggle and the "Aparência" card of Configurações (FR-UI-39…42). */
export interface ThemeStrings {
  toDark: string;
  toLight: string;
  title: string;
  current: string;
  system: string;
  light: string;
  dark: string;
  followSystem: string;
  writeFailed: string;
}

/** Fixed texts of the Histórico screen (spec historico §7). Texts with values arrive ready in the answers. */
export interface HistoryStrings {
  search: string;
  copy: string;
  copied: string;
  remove: string;
  clear: string;
  confirmClear: string;
  cancel: string;
  loadMore: string;
  empty: string;
  noResults: string;
  disabled: string;
  unavailable: string;
  openSettings: string;
  deleted: string;
  cleared: string;
  failed: string;
}

/** Fixed texts of the "Guardar histórico" control in Configurações (FR-UI-38, spec historico §7). */
export interface RetentionStrings {
  title: string;
  label: string;
  never: string;
  forDays: string;
  daysUnit: string;
  daysField: string;
  forever: string;
  range: string;
  hint: string;
  save: string;
  saved: string;
  writeFailed: string;
  invalid: string;
}

/** Fixed texts of the history cards of Início (spec historico FR-HIST-22…26). */
export interface HomeHistoryStrings {
  recentTitle: string;
  seeAll: string;
  usageTitle: string;
  today: string;
  allTime: string;
  words: string;
  dictations: string;
  spoken: string;
  wordsPerMinute: string;
  off: string;
}

// ---- History (spec historico §10) -------------------------------------------------------------------

/** How the insertion of a dictation ended (InsertOutcome, or `failed` when it threw after the text existed). */
export type HistoryEntryStatus = 'inserted' | 'copied' | 'failed';

/** `0` = never store, 1 to 3650 days, `null` = forever (config.json `history.retentionDays`). */
export type RetentionDays = number | null;

/** The answers say whether the history can answer at all: `disabled` = retention 0, `unavailable` = no database. */
export type HistoryAvailability = 'ok' | 'disabled' | 'unavailable';

export interface HistoryEntry {
  /** sessionId of the dictation that created it. */
  id: string;
  text: string;
  /** ISO-8601 UTC. */
  createdAt: string;
  /** YYYY-MM-DD in the local time zone, to group by day. */
  dayKey: string;
  /** "Hoje", "Ontem", "17 de outubro", "30 de dezembro de 2025". */
  dayLabel: string;
  /** "14:32" */
  timeLabel: string;
  /** "0:12" */
  durationLabel: string;
  status: HistoryEntryStatus;
  /** Notice of strings.ts; null for `inserted`. */
  statusLabel: string | null;
  /** Accessible names of the two buttons, with the day and the time of the entry. */
  copyLabel: string;
  deleteLabel: string;
}

export interface HistoryListInput {
  /** Up to 200 characters after trim. */
  query?: string;
  /** Opaque, as returned in nextCursor. */
  cursor?: string | null;
  /** Integer 1 to 100; 50 by default. */
  limit?: number;
}

export interface HistoryListResult {
  status: HistoryAvailability;
  entries: HistoryEntry[];
  nextCursor: string | null;
  retentionLabel: string;
  /** Failed writes since the app opened (FR-HIST-17); memory only. */
  unsavedCount: number;
  /** The banner text for unsavedCount, or null when it is 0. */
  unsavedLabel: string | null;
}

export interface HistoryCopyResult {
  result: 'copied' | 'not_found' | 'unavailable';
}

export interface HistoryDeleteResult {
  result: 'deleted' | 'not_found' | 'unavailable';
}

export interface HistoryClearResult {
  result: 'cleared' | 'unavailable';
  count: number;
}

export interface HistoryRetentionView {
  retentionDays: RetentionDays;
  retentionLabel: string;
}

export interface HistorySetRetentionResult {
  result: 'saved' | 'write_failed';
  /** The retention in use after the answer (the previous one on write_failed). */
  retentionDays: RetentionDays;
  /** Entries removed by the new retention. */
  purged: number;
  /** "Salvo" or "Salvo · 12 ditados mais antigos foram apagados"; null on write_failed. */
  savedLabel: string | null;
}

/** Totals of a period, with the labels ready (FR-HIST-23). */
export interface HistoryTotals {
  words: number;
  dictations: number;
  spokenMs: number;
  wordsLabel: string;
  dictationsLabel: string;
  spokenLabel: string;
}

/** history:stats — aggregate without any dictated text (FR-HIST-22…26). */
export interface HistoryStatsView {
  status: HistoryAvailability;
  today: HistoryTotals;
  allTime: HistoryTotals;
  /** Total words / total minutes, over entries with a recording duration; null without any. */
  wordsPerMinute: number | null;
  wordsPerMinuteLabel: string;
  retentionLabel: string;
}

export type HistoryChangeReason = 'saved' | 'deleted' | 'cleared' | 'purged';

export interface HistoryChangedPayload {
  reason: HistoryChangeReason;
}
