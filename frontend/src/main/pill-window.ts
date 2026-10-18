// The floating status pill (docs/DESIGN.md §6). It never takes focus or mouse input, and it is the only
// renderer allowed to record: getUserMedia only exists in a renderer, and the microphone permission goes to
// the pill alone (the main window of spec janela-principal never gets it).
import { BrowserWindow, screen } from 'electron';
import * as path from 'node:path';
import { Channel, type PillState } from '../shared/ipc';

const WIDTH = 420;
const HEIGHT = 72;
const EDGE_OFFSET = 24;
const HIDE_AFTER_FADE_MS = 200;

export class PillWindow {
  readonly win: BrowserWindow;
  private hideTimer: NodeJS.Timeout | null = null;

  /**
   * `overFullScreen` (macOS — spec distribuicao-windows-macos FR-MAC-13): the pill is an NSPanel that also shows
   * on every Space and over full-screen apps, still without focus. To be confirmed on a real Mac (T4).
   */
  constructor(
    distDir: string,
    private readonly position: 'bottom-center' | 'top-center',
    allowDevTools: boolean,
    overFullScreen = false,
  ) {
    this.win = new BrowserWindow({
      ...(overFullScreen ? { type: 'panel' } : {}),
      width: WIDTH,
      height: HEIGHT,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(distDir, 'preload', 'pill.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
        spellcheck: false,
        devTools: allowDevTools,
      },
    });
    this.win.setAlwaysOnTop(true, 'screen-saver');
    if (overFullScreen) this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.win.setIgnoreMouseEvents(true);
    this.win.setMenu(null);
  }

  load(distDir: string): Promise<void> {
    return this.win.loadFile(path.join(distDir, 'renderer', 'pill.html'));
  }

  get webContents(): Electron.WebContents {
    return this.win.webContents;
  }

  send(channel: string, payload: unknown): void {
    if (!this.win.isDestroyed()) this.win.webContents.send(channel, payload);
  }

  setState(state: PillState): void {
    this.send(Channel.PillState, state);
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (state.state === 'hidden') {
      this.hideTimer = setTimeout(() => {
        if (!this.win.isDestroyed()) this.win.hide();
      }, HIDE_AFTER_FADE_MS);
      return;
    }
    if (!this.win.isVisible()) {
      this.placeNearCursor();
      this.win.showInactive();
    }
  }

  private placeNearCursor(): void {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const x = Math.round(area.x + (area.width - WIDTH) / 2);
    const y =
      this.position === 'top-center' ? area.y + EDGE_OFFSET : Math.round(area.y + area.height - HEIGHT - EDGE_OFFSET);
    this.win.setBounds({ x, y, width: WIDTH, height: HEIGHT });
  }
}
