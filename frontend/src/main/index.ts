// Touch Speaker — main process entry point.
import { app, ipcMain, Menu, session as electronSession, type IpcMainEvent } from 'electron';
import * as path from 'node:path';
import {
  Channel,
  type RecorderErrorCode,
  type RecorderErrorPayload,
  type RecorderResultPayload,
  type RecorderStartedPayload,
} from '../shared/ipc';
import { loadConfig } from './config';
import { DEFAULT_HOTKEY_TIMING, HotkeyController } from './hotkey';
import { TextInserter } from './insert/inserter';
import { initWin32, isSelfElevated } from './insert/win32';
import { startKeyboardHook } from './keyboard';
import { HOTKEY_CODES } from './keys';
import { Logger } from './logger';
import { PillWindow } from './pill-window';
import { IdentityRefiner } from './refine';
import { SessionController } from './session';
import { GroqTranscriber } from './transcribe/groq';
import { AppTray } from './tray';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const RECORDER_ERROR_CODES: readonly RecorderErrorCode[] = ['mic_denied', 'mic_unavailable', 'recorder_failed'];

app.setName('Touch Speaker');
app.setPath('userData', path.join(app.getPath('appData'), 'Touch Speaker'));
app.setAppUserModelId('com.victoralves.touchspeaker');
// A 40 px pill does not need the GPU; software compositing saves memory (NFR-03).
app.disableHardwareAcceleration();

// Development key lives in frontend/.env (docs/Security-Guide.md §5).
try {
  process.loadEnvFile(path.join(app.getAppPath(), '.env'));
} catch {
  // No .env: dictation will show "no_api_key".
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
  const config = loadConfig(userData, (field) => log.warn('config_invalid_field', { field }));
  const distDir = path.join(app.getAppPath(), 'dist');

  // Hardening for every web contents (docs/Security-Guide.md §8).
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

  // Microphone only, only for the pill (docs/Security-Guide.md §3).
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

  const transcriber = new GroqTranscriber({ apiKey: process.env.GROQ_API_KEY, model: config.transcription.model });

  let tray: AppTray | null = null;
  let hotkey: HotkeyController | null = null;

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
    onRecordingChange: (recording) => tray?.setRecording(recording),
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

  let quitting = false;
  const quit = () => {
    if (quitting) return;
    quitting = true;
    session.shutdown();
    stopKeyboard?.();
    tray?.destroy();
    app.quit();
  };

  tray = new AppTray({
    configDir: userData,
    hasApiKey: transcriber.hasCredentials(),
    customMicrophone: config.microphoneDeviceId !== null,
    onQuit: quit,
  });

  app.on('second-instance', () => log.info('second_instance_ignored'));
  app.on('window-all-closed', () => {
    // Tray app: keep running without windows.
  });
  app.on('before-quit', () => {
    session.shutdown();
    stopKeyboard?.();
  });

  log.info('app_ready', {
    version: app.getVersion(),
    electron: process.versions.electron ?? null,
    hotkey: config.hotkey,
    has_api_key: transcriber.hasCredentials(),
    keyboard_hook: stopKeyboard !== null,
    self_elevated: selfElevated,
  });
}
