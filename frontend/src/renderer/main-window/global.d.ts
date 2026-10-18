// Shape of window.touchSpeakerApp (exposed by src/preload/main-window.ts). Mirrors src/shared/ipc.ts —
// the three files change together (docs/Code-Style.md). Own tsc program (tsconfig.main-window.json), so these
// global names never meet the pill's (src/renderer/global.d.ts). Not named main-window.d.ts: tsc would take
// it for the declaration output of main-window.ts and skip it.

type HotkeyName =
  | 'RightCtrl'
  | 'RightAlt'
  | 'RightShift'
  | 'CapsLock'
  | 'F13'
  | 'F14'
  | 'F15'
  | 'F16'
  | 'F17'
  | 'F18'
  | 'F19'
  | 'F20'
  | 'F21'
  | 'F22'
  | 'F23'
  | 'F24';

type GroqKeyState = 'stored' | 'env' | 'none' | 'unreadable';
type TranscriptionModel = 'whisper-large-v3-turbo' | 'whisper-large-v3';
type PillPosition = 'bottom-center' | 'top-center';
type MicrophoneSource = 'default' | 'custom';
type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

interface AppStatus {
  groqKey: GroqKeyState;
  encryptionAvailable: boolean;
  keyboardHook: boolean;
  recording: boolean;
  hotkey: HotkeyName;
  holdThresholdMs: number;
  howTo: string[];
  microphone: MicrophoneSource;
  theme: ThemePreference;
}

type ThemeResult = { ok: true; theme: ThemePreference } | { ok: false; code: 'write_failed'; theme: ThemePreference };

interface ThemeStrings {
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

interface EditableSettings {
  hotkey: HotkeyName;
  holdThresholdMs: number;
  maxRecordingMs: number;
  language: string;
  model: TranscriptionModel;
  pillPosition: PillPosition;
  sounds: boolean;
}

interface LoginItemView {
  available: boolean;
  enabled: boolean;
}

interface SettingsView {
  values: EditableSettings;
  restartPending: boolean;
  hotkeys: HotkeyName[];
  microphone: MicrophoneSource;
  loginItem: LoginItemView;
}

type SettingsResult =
  | { ok: true; restartPending: boolean }
  | { ok: false; code: 'invalid_field'; field: keyof EditableSettings }
  | { ok: false; code: 'write_failed' };

type LoginItemResult =
  | { ok: true; enabled: boolean }
  | { ok: false; code: 'unavailable' | 'login_item_failed'; enabled: boolean };

type GroqKeyResult =
  | { ok: true; state: GroqKeyState }
  | { ok: false; code: 'invalid_format' | 'encryption_unavailable' | 'write_failed' };

interface MainWindowStrings {
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

interface HistoryStrings {
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

interface RetentionStrings {
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

interface HomeHistoryStrings {
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

type HistoryEntryStatus = 'inserted' | 'copied' | 'failed';
type RetentionDays = number | null;
type HistoryAvailability = 'ok' | 'disabled' | 'unavailable';

interface HistoryEntry {
  id: string;
  text: string;
  createdAt: string;
  dayKey: string;
  dayLabel: string;
  timeLabel: string;
  durationLabel: string;
  status: HistoryEntryStatus;
  statusLabel: string | null;
  copyLabel: string;
  deleteLabel: string;
}

interface HistoryListInput {
  query?: string;
  cursor?: string | null;
  limit?: number;
}

interface HistoryListResult {
  status: HistoryAvailability;
  entries: HistoryEntry[];
  nextCursor: string | null;
  retentionLabel: string;
  unsavedCount: number;
  unsavedLabel: string | null;
}

interface HistoryCopyResult {
  result: 'copied' | 'not_found' | 'unavailable';
}

interface HistoryDeleteResult {
  result: 'deleted' | 'not_found' | 'unavailable';
}

interface HistoryClearResult {
  result: 'cleared' | 'unavailable';
  count: number;
}

interface HistoryRetentionView {
  retentionDays: RetentionDays;
  retentionLabel: string;
}

interface HistorySetRetentionResult {
  result: 'saved' | 'write_failed';
  retentionDays: RetentionDays;
  purged: number;
  savedLabel: string | null;
}

interface HistoryTotals {
  words: number;
  dictations: number;
  spokenMs: number;
  wordsLabel: string;
  dictationsLabel: string;
  spokenLabel: string;
}

interface HistoryStatsView {
  status: HistoryAvailability;
  today: HistoryTotals;
  allTime: HistoryTotals;
  wordsPerMinute: number | null;
  wordsPerMinuteLabel: string;
  retentionLabel: string;
}

type HistoryChangeReason = 'saved' | 'deleted' | 'cleared' | 'purged';

interface HistoryChangedPayload {
  reason: HistoryChangeReason;
}

interface HistoryApi {
  list(input: HistoryListInput): Promise<HistoryListResult>;
  copy(id: string): Promise<HistoryCopyResult>;
  delete(id: string): Promise<HistoryDeleteResult>;
  clear(confirmed: true): Promise<HistoryClearResult>;
  getRetention(): Promise<HistoryRetentionView>;
  setRetention(retentionDays: RetentionDays): Promise<HistorySetRetentionResult>;
  stats(): Promise<HistoryStatsView>;
  onChanged(callback: (payload: HistoryChangedPayload) => void): void;
}

interface TouchSpeakerAppApi {
  getStrings(): Promise<MainWindowStrings>;
  getStatus(): Promise<AppStatus>;
  onStatus(callback: (status: AppStatus) => void): void;
  getSettings(): Promise<SettingsView>;
  saveSettings(input: EditableSettings): Promise<SettingsResult>;
  setGroqKey(key: string): Promise<GroqKeyResult>;
  removeGroqKey(): Promise<GroqKeyResult>;
  setLoginItem(enabled: boolean): Promise<LoginItemResult>;
  relaunch(): void;
  setTheme(theme: ThemePreference): Promise<ThemeResult>;
  /** Spec historico §10 (+ stats, FR-HIST-22). */
  history: HistoryApi;
}

interface Window {
  touchSpeakerApp: TouchSpeakerAppApi;
}
