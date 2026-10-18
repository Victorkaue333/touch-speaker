// Touch Speaker — main process entry point.
import {
  app,
  clipboard,
  ipcMain,
  Menu,
  nativeTheme,
  safeStorage,
  session as electronSession,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import * as path from 'node:path';
import {
  type AppStatus,
  Channel,
  type GroqKeyResult,
  type RecorderErrorCode,
  type RecorderErrorPayload,
  type RecorderResultPayload,
  type RecorderStartedPayload,
  type SettingsView,
  type ThemeResult,
} from '../shared/ipc';
import { ConfigWriter, loadConfig } from './config';
import { CredentialStore } from './credentials';
import { asHistoryClearInput, asHistoryIdInput, asHistoryListInput, asRetentionInput } from './history/ipc';
import { historyLocation } from './history/paths';
import { HistoryService, openHistory } from './history/service';
import { DEFAULT_HOTKEY_TIMING, HotkeyController } from './hotkey';
import { TextInserter } from './insert/inserter';
import { initWin32, isSelfElevated } from './insert/win32';
import { startKeyboardHook } from './keyboard';
import { HOTKEY_CODES, type HotkeyName } from './keys';
import { Logger } from './logger';
import { LoginItem } from './login-item';
import { MainWindow } from './main-window';
import { asGroqKeyInput, asLoginItemInput, asSettingsInput, asThemeInput, isEmptyPayload } from './main-window-ipc';
import { PillWindow } from './pill-window';
import { IdentityRefiner } from './refine';
import { SessionController } from './session';
import { SettingsStore, shouldOpenOnFirstRun } from './settings';
import { ThemeSetting } from './theme-setting';
import { hotkeyNames, mainWindowStrings, strings } from './strings';
import { GroqTranscriber } from './transcribe/groq';
import { AppTray } from './tray';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const RECORDER_ERROR_CODES: readonly RecorderErrorCode[] = ['mic_denied', 'mic_unavailable', 'recorder_failed'];

app.setName('Touch Speaker');
app.setPath('userData', path.join(app.getPath('appData'), 'Touch Speaker'));
app.setAppUserModelId('com.victoralves.touchspeaker');
// A 40 px pill does not need the GPU; software compositing saves memory (NFR-03).
app.disableHardwareAcceleration();

// frontend/.env is a development fallback for the Groq key (ADR-08): the packaged app never reads it.
// The key saved on screen (safeStorage) comes first — CredentialStore.
if (!app.isPackaged) {
  try {
    process.loadEnvFile(path.join(app.getAppPath(), '.env'));
  } catch {
    // No .env: the key comes from the screen, or dictation shows "no_api_key".
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(main, (err: unknown) => {
    console.error('Touch Speaker failed to start', err);
    app.exit(1);
  });
}

// ---- IPC payload validation (renderer input is untrusted) ------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asStarted(p: unknown): RecorderStartedPayload | null {
  return isRecord(p) && typeof p.sessionId === 'string' && typeof p.startedAt === 'number'
    ? { sessionId: p.sessionId, startedAt: p.startedAt }
    : null;
}

function toArrayBuffer(v: unknown): ArrayBuffer | null {
  if (v instanceof ArrayBuffer) return v;
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice().buffer;
  return null;
}

function asResult(p: unknown): RecorderResultPayload | null {
  if (!isRecord(p) || typeof p.sessionId !== 'string' || typeof p.mimeType !== 'string') return null;
  if (typeof p.durationMs !== 'number' || !Number.isFinite(p.durationMs) || p.durationMs < 0) return null;
  if (!p.mimeType.startsWith('audio/')) return null;
  const audio = toArrayBuffer(p.audio);
  if (!audio || audio.byteLength > MAX_AUDIO_BYTES) return null;
  return { sessionId: p.sessionId, audio, mimeType: p.mimeType, durationMs: p.durationMs };
}

function asError(p: unknown): RecorderErrorPayload | null {
  if (!isRecord(p) || typeof p.sessionId !== 'string') return null;
  const code = RECORDER_ERROR_CODES.find((c) => c === p.code);
  return code ? { sessionId: p.sessionId, code } : null;
}

// ---- App --------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  Menu.setApplicationMenu(null);
  const userData = app.getPath('userData');
  const log = new Logger(path.join(userData, 'logs'));
  const { config, created: configCreated } = loadConfig(userData, (field) => log.warn('config_invalid_field', { field }));
  const distDir = path.join(app.getAppPath(), 'dist');
  // The theme choice drives every window, the pill included, through prefers-color-scheme, and the native
  // title bar (FR-UI-39) — applied here, before any window exists, so nothing paints in the other theme. The
  // tray keeps following the taskbar: on Windows shouldUseDarkColorsForSystemIntegratedUI ignores themeSource.
  const configWriter = new ConfigWriter(userData);
  const theme = new ThemeSetting({
    inUse: config.theme,
    writer: configWriter,
    apply: (value) => {
      nativeTheme.themeSource = value;
    },
    log,
  });

  // Hardening for every web contents (docs/Security-Guide.md §9).
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event) => event.preventDefault());
  });

  const pill = new PillWindow(distDir, config.pill.position, !app.isPackaged);
  // Renderer diagnostics. The pill never logs user content, so its console is safe to keep.
  pill.webContents.on('console-message', (details) => {
    if (details.level === 'error' || details.level === 'warning') {
      log.warn('pill_console', { level: details.level, message: details.message.slice(0, 300), line: details.lineNumber });
    }
  });
  pill.webContents.on('render-process-gone', (_event, details) => log.error('pill_renderer_gone', { reason: details.reason }));

  // Microphone only, only for the pill (docs/Security-Guide.md §5). The main window never gets it.
  const ses = electronSession.defaultSession;
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? (details.mediaTypes ?? []) : [];
    const audioOnly = mediaTypes.length > 0 && mediaTypes.every((t) => t === 'audio');
    callback(contents === pill.webContents && permission === 'media' && audioOnly);
  });
  ses.setPermissionCheckHandler((contents, permission) => contents === pill.webContents && permission === 'media');

  await pill.load(distDir);

  let selfElevated = false;
  try {
    initWin32();
    selfElevated = isSelfElevated();
  } catch (err) {
    log.error('win32_unavailable', { name: err instanceof Error ? err.name : 'unknown' });
  }

  // The Groq key (ADR-08): groq-key.bin through safeStorage, else the .env (unpackaged only), else none.
  // safeStorage is only usable after `ready`, which is why the store is built here.
  const credentials = new CredentialStore({
    dir: userData,
    cipher: {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      encrypt: (plain) => safeStorage.encryptString(plain),
      decrypt: (data) => safeStorage.decryptString(data),
    },
    envKey: process.env.GROQ_API_KEY,
    packaged: app.isPackaged,
  });
  const keyLoad = credentials.load();
  if (keyLoad.state === 'unreadable') log.warn('groq_key_unreadable', { reason: keyLoad.unreadableReason ?? 'unknown' });

  const transcriber = new GroqTranscriber({ getApiKey: () => credentials.current(), model: config.transcription.model });

  const mainWindow = new MainWindow({ distDir, allowDevTools: !app.isPackaged, log });
  const settings = new SettingsStore({ dir: userData, inUse: config, writer: configWriter });
  const loginItem = new LoginItem(app);

  // The dictation history (spec historico): SQLite in %LOCALAPPDATA%\Touch Speaker (never the Roaming folder),
  // opened before the session. If it does not open, dictation works exactly as before (FR-HIST-16).
  const history = new HistoryService({
    store: openHistory({
      location: historyLocation({ platform: process.platform, env: process.env, appData: app.getPath('appData') }),
      migrationsDir: path.join(distDir, 'database', 'local'),
      retentionDays: config.history.retentionDays,
      log,
    }),
    retentionDays: config.history.retentionDays,
    writer: configWriter,
    clipboard: { writeText: (text) => clipboard.writeText(text) },
    notify: (reason) => mainWindow.send(Channel.HistoryChanged, { reason }),
    log,
  });

  let tray: AppTray | null = null;
  let hotkey: HotkeyController | null = null;
  let recording = false;
  let keyboardHook = false;

  // What the main window shows on Início (spec janela-principal §10). Never the key itself (FR-UI-22).
  const buildStatus = (): AppStatus => {
    const keyName = hotkeyNames[config.hotkey];
    return {
      groqKey: credentials.state(),
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
      keyboardHook,
      recording,
      hotkey: config.hotkey,
      holdThresholdMs: config.holdThresholdMs,
      howTo: [strings.homeHold(keyName, config.holdThresholdMs), strings.homeTap(keyName), strings.homeEsc],
      microphone: config.microphoneDeviceId !== null ? 'custom' : 'default',
      theme: theme.current(),
    };
  };
  const pushStatus = () => mainWindow.send(Channel.AppStatus, buildStatus());

  const session = new SessionController({
    config,
    transcriber,
    refiner: new IdentityRefiner(),
    inserter: new TextInserter({
      isHotkeyDown: () => hotkey?.isHotkeyDown() ?? false,
      setInserting: (value) => session.setInserting(value),
      selfElevated,
    }),
    pill,
    log,
    history,
    // The window only observes the session; SessionController stays the single owner of its state.
    onRecordingChange: (value) => {
      recording = value;
      tray?.setRecording(value);
      pushStatus();
    },
  });

  hotkey = new HotkeyController(session, {
    holdThresholdMs: config.holdThresholdMs,
    ...DEFAULT_HOTKEY_TIMING,
    now: Date.now,
  });

  const fromPill = (event: IpcMainEvent) => event.sender === pill.webContents;
  ipcMain.on(Channel.RecorderStarted, (event, payload: unknown) => {
    const p = fromPill(event) ? asStarted(payload) : null;
    if (p) session.onRecorderStarted(p);
  });
  ipcMain.on(Channel.RecorderResult, (event, payload: unknown) => {
    const p = fromPill(event) ? asResult(payload) : null;
    if (p) void session.onRecorderResult(p);
    else if (fromPill(event)) log.warn('ipc_rejected', { channel: Channel.RecorderResult });
  });
  ipcMain.on(Channel.RecorderError, (event, payload: unknown) => {
    const p = fromPill(event) ? asError(payload) : null;
    if (p) session.onRecorderError(p);
  });

  let stopKeyboard: (() => void) | null = null;
  try {
    stopKeyboard = startKeyboardHook(HOTKEY_CODES[config.hotkey], hotkey);
  } catch (err) {
    log.error('keyboard_hook_unavailable', { name: err instanceof Error ? err.name : 'unknown' });
  }
  keyboardHook = stopKeyboard !== null;

  let quitting = false;
  const quit = () => {
    if (quitting) return;
    quitting = true;
    session.shutdown();
    stopKeyboard?.();
    tray?.destroy();
    history.close();
    app.quit();
  };

  // ---- IPC main ⇄ main window (spec janela-principal §10, FR-UI-33) ---------------------------------
  // Registered once, here; every message is checked against the window open now. A message from anyone
  // else, or with a malformed payload, is dropped: logged as ipc_rejected (channel only) and the invoke
  // rejects. The Groq key is never logged nor sent back.

  const rejected = (channel: string): never => {
    log.warn('ipc_rejected', { channel });
    throw new Error('ipc_rejected');
  };
  const handleWindow = (channel: string, run: (args: unknown[]) => unknown): void => {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) =>
      mainWindow.isSender(event) ? run(args) : rejected(channel),
    );
  };
  const afterKeyChange = () => {
    tray?.setGroqKeyState(transcriber.hasCredentials());
    pushStatus();
  };

  handleWindow(Channel.AppGetStrings, (args) => (isEmptyPayload(args) ? mainWindowStrings() : rejected(Channel.AppGetStrings)));

  handleWindow(Channel.AppGetStatus, (args) => (isEmptyPayload(args) ? buildStatus() : rejected(Channel.AppGetStatus)));

  handleWindow(Channel.SettingsGet, (args): SettingsView => {
    if (!isEmptyPayload(args)) return rejected(Channel.SettingsGet);
    const { values, restartPending } = settings.read();
    return {
      values,
      restartPending,
      hotkeys: Object.keys(HOTKEY_CODES) as HotkeyName[],
      microphone: config.microphoneDeviceId !== null ? 'custom' : 'default',
      loginItem: loginItem.read(),
    };
  });

  handleWindow(Channel.SettingsSave, async (args) => {
    const input = asSettingsInput(args);
    if (!input) return rejected(Channel.SettingsSave);
    const outcome = await settings.save(input);
    if (outcome.kind === 'saved') log.info('settings_saved', { fields: outcome.fields.join(',') });
    else if (outcome.kind === 'invalid_field') log.warn('settings_rejected', { field: outcome.field });
    else log.error('settings_write_failed', { name: outcome.name });
    return outcome.result;
  });

  handleWindow(Channel.GroqKeySet, (args): GroqKeyResult => {
    const input = asGroqKeyInput(args);
    if (input.kind === 'rejected') return rejected(Channel.GroqKeySet);
    if (input.kind === 'invalid_format') {
      log.warn('groq_key_rejected', { reason: 'invalid_format' });
      return { ok: false, code: 'invalid_format' };
    }
    const saved = credentials.save(input.key);
    if (!saved.ok) {
      log.warn('groq_key_rejected', { reason: saved.code, name: saved.name ?? null });
      return { ok: false, code: saved.code };
    }
    log.info('groq_key_saved');
    afterKeyChange();
    return { ok: true, state: saved.state };
  });

  handleWindow(Channel.GroqKeyRemove, (args): GroqKeyResult => {
    if (!isEmptyPayload(args)) return rejected(Channel.GroqKeyRemove);
    const removed = credentials.remove();
    if (!removed.ok) {
      log.warn('groq_key_rejected', { reason: 'write_failed', name: removed.name });
      return { ok: false, code: 'write_failed' };
    }
    log.info('groq_key_removed', { state: removed.state });
    afterKeyChange();
    return { ok: true, state: removed.state };
  });

  handleWindow(Channel.LoginItemSet, (args) => {
    const input = asLoginItemInput(args);
    if (!input) return rejected(Channel.LoginItemSet);
    const { result, name } = loginItem.set(input.enabled);
    if (result.ok) log.info('login_item_changed', { enabled: result.enabled });
    else if (result.code === 'login_item_failed') log.error('login_item_failed', { name: name ?? 'unknown' });
    return result;
  });

  // ---- Theme (spec janela-principal FR-UI-40): config.json `theme` through the same queue, then themeSource.
  // The window already shows the new theme (data-theme, set inside the View Transition); a failed write keeps
  // the theme in use and the window goes back to it.
  handleWindow(Channel.ThemeSet, (args): Promise<ThemeResult> => {
    const input = asThemeInput(args);
    return input ? theme.set(input.theme) : rejected(Channel.ThemeSet);
  });

  // ---- History (spec historico §10, FR-HIST-19): same sender check; payloads validated in history/ipc.ts ----

  handleWindow(Channel.HistoryList, (args) => {
    const input = asHistoryListInput(args);
    return input ? history.list(input) : rejected(Channel.HistoryList);
  });

  handleWindow(Channel.HistoryCopy, (args) => {
    const id = asHistoryIdInput(args);
    return id ? history.copy(id) : rejected(Channel.HistoryCopy);
  });

  handleWindow(Channel.HistoryDelete, (args) => {
    const id = asHistoryIdInput(args);
    return id ? history.remove(id) : rejected(Channel.HistoryDelete);
  });

  handleWindow(Channel.HistoryClear, (args) => (asHistoryClearInput(args) ? history.clear() : rejected(Channel.HistoryClear)));

  handleWindow(Channel.HistoryGetRetention, (args) =>
    isEmptyPayload(args) ? history.getRetention() : rejected(Channel.HistoryGetRetention),
  );

  handleWindow(Channel.HistorySetRetention, (args) => {
    const input = asRetentionInput(args);
    return input ? history.setRetention(input.retentionDays) : rejected(Channel.HistorySetRetention);
  });

  handleWindow(Channel.HistoryStats, (args) => (isEmptyPayload(args) ? history.stats() : rejected(Channel.HistoryStats)));

  // "Reiniciar agora" (FR-UI-32): the same path as "Sair", then the app opens again.
  ipcMain.on(Channel.AppRelaunch, (event, ...args: unknown[]) => {
    if (!mainWindow.isSender(event) || !isEmptyPayload(args)) {
      log.warn('ipc_rejected', { channel: Channel.AppRelaunch });
      return;
    }
    log.info('app_relaunch');
    app.relaunch();
    quit();
  });

  tray = new AppTray({
    configDir: userData,
    hasApiKey: transcriber.hasCredentials(),
    customMicrophone: config.microphoneDeviceId !== null,
    onOpenWindow: (trigger) => mainWindow.show(trigger),
    onQuit: quit,
  });

  // Opening the app again shows the window of the instance already running (FR-UI-04).
  app.on('second-instance', () => {
    log.info('second_instance_focus');
    mainWindow.show('second_instance');
  });
  app.on('window-all-closed', () => {
    // Tray app: closing the main window keeps the app, the hook and any dictation running (FR-UI-05).
  });
  app.on('before-quit', () => {
    session.shutdown();
    stopKeyboard?.();
    history.close();
  });

  log.info('app_ready', {
    version: app.getVersion(),
    electron: process.versions.electron ?? null,
    hotkey: config.hotkey,
    has_api_key: transcriber.hasCredentials(),
    groq_key: credentials.state(),
    keyboard_hook: keyboardHook,
    self_elevated: selfElevated,
  });

  // The only time the window opens by itself: first run (config.json created now) without a stored key,
  // after the tray exists and before any dictation (FR-UI-35, FR-UI-06).
  if (shouldOpenOnFirstRun(configCreated, credentials.state())) mainWindow.show('first_run', 'settings');
}
