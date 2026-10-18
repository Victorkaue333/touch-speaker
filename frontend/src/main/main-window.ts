// The main window (spec janela-principal §7, §8): an ordinary Windows window opened when the person asks
// (tray menu, double click on the tray icon, opening the app again) — and by itself only once, on the first
// run without a stored key (FR-UI-35). Created on demand and destroyed on close, so a closed window costs no
// memory (NFR-03). Sandboxed, context-isolated, no Node, no media permission (the session handler in
// index.ts grants the microphone to the pill only), strict CSP in its index.html.
import { BrowserWindow, nativeTheme, screen, type WebContents } from 'electron';
import * as path from 'node:path';
import { PALETTE } from '../shared/palette';
import { errorName } from './atomic-file';
import { readTaskbarTheme, windowIcon } from './icon';
import type { Logger } from './logger';
import { isMainWindowSender } from './main-window-ipc';
import { mainWindowStrings } from './strings';

export type MainWindowTrigger = 'tray_menu' | 'tray_double_click' | 'second_instance' | 'first_run';
export type MainWindowSection = 'home' | 'settings';

const WIDTH = 960;
const HEIGHT = 640;
const MIN_WIDTH = 760;
const MIN_HEIGHT = 520;

export interface MainWindowOptions {
  distDir: string;
  allowDevTools: boolean;
  log: Logger;
}

/** The part of an IPC event the sender check reads. */
export interface IpcSenderEvent {
  sender: unknown;
  senderFrame: { url: string; parent: unknown } | null;
}

export class MainWindow {
  /** The page the window loads; the only URL whose messages are accepted (FR-UI-33). */
  readonly pageFile: string;
  private readonly preload: string;
  private win: BrowserWindow | null = null;
  private readonly onThemeUpdated = () => this.applyTheme();

  constructor(private readonly opts: MainWindowOptions) {
    this.pageFile = path.join(opts.distDir, 'renderer', 'main-window', 'index.html');
    this.preload = path.join(opts.distDir, 'preload', 'main-window.js');
  }

  /** The webContents of the window open now, or null. */
  get webContents(): WebContents | null {
    return this.win && !this.win.isDestroyed() ? this.win.webContents : null;
  }

  /** FR-UI-33: the message comes from this window, open now, from its top frame, showing index.html. */
  isSender(event: IpcSenderEvent): boolean {
    const frame = event.senderFrame;
    const identity = frame ? { url: frame.url, isTop: frame.parent === null } : null;
    return isMainWindowSender(event.sender, identity, this.webContents, this.pageFile);
  }

  /** Shows the window with focus: restores it if it exists (FR-UI-03), creates it otherwise (FR-UI-01). */
  show(trigger: MainWindowTrigger, section: MainWindowSection = 'home'): void {
    this.opts.log.info('main_window_opened', { trigger });
    const win = this.win;
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return;
    }
    this.create(section);
  }

  /** main → window (app:status); dropped when the window is closed. */
  send(channel: string, payload: unknown): void {
    this.webContents?.send(channel, payload);
  }

  private create(section: MainWindowSection): void {
    const createdAt = Date.now();
    const win = new BrowserWindow({
      ...this.initialBounds(),
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      show: false,
      title: mainWindowStrings().appName,
      // Same colour as --ts-bg of the theme in force, so the window never flashes white (FR-UI-34).
      backgroundColor: this.background(),
      icon: windowIcon(readTaskbarTheme()),
      skipTaskbar: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.preload,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: false,
        devTools: this.opts.allowDevTools,
      },
    });
    win.setMenu(null);
    this.win = win;
    nativeTheme.on('updated', this.onThemeUpdated);

    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return;
      win.show();
      win.focus();
      this.opts.log.info('main_window_ready', { ready_ms: Date.now() - createdAt });
    });
    // The window handles the Groq key: its console goes to the log without the message (spec §6).
    win.webContents.on('console-message', (details) => {
      if (details.level === 'error' || details.level === 'warning') {
        this.opts.log.warn('main_window_console', { level: details.level, line: details.lineNumber });
      }
    });
    // Development only: F12 opens the DevTools of this window (there is no menu to do it), for the
    // checks of the spec's roteiro (VJ12, VJ14, VJ16, VJ23). Only this key is looked at, and nothing is logged.
    if (this.opts.allowDevTools) {
      win.webContents.on('before-input-event', (_event, input) => {
        if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
      });
    }
    win.webContents.on('render-process-gone', (_event, details) => {
      this.opts.log.error('main_window_renderer_gone', { reason: details.reason });
      if (!win.isDestroyed()) win.destroy();
    });
    win.on('closed', () => {
      nativeTheme.off('updated', this.onThemeUpdated);
      if (this.win === win) this.win = null;
      this.opts.log.info('main_window_closed');
    });

    // The hash only tells the page which section to open first (Configurações on first run, FR-UI-35).
    win.loadFile(this.pageFile, section === 'settings' ? { hash: 'settings' } : {}).catch((err: unknown) => {
      this.opts.log.error('main_window_load_failed', { name: errorName(err) });
    });
  }

  /** Centred on the display under the mouse, like the pill (spec §5.8, "Duas telas"). */
  private initialBounds(): { x: number; y: number; width: number; height: number } {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const x = Math.max(area.x, Math.round(area.x + (area.width - WIDTH) / 2));
    const y = Math.max(area.y, Math.round(area.y + (area.height - HEIGHT) / 2));
    return { x, y, width: WIDTH, height: HEIGHT };
  }

  private background(): string {
    return nativeTheme.shouldUseDarkColors ? PALETTE.blackHole : PALETTE.alabaster;
  }

  /** The app mode changed: the frame follows by itself, the content through prefers-color-scheme (FR-UI-34). */
  private applyTheme(): void {
    if (this.win && !this.win.isDestroyed()) this.win.setBackgroundColor(this.background());
  }
}
