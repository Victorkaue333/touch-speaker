import { Menu, Tray, nativeTheme, shell } from 'electron';
import type { TaskbarTheme } from '../shared/palette';
import { readTaskbarTheme, trayIcon } from './icon';
import { strings } from './strings';

export type TrayOpenTrigger = 'tray_menu' | 'tray_double_click';

export interface TrayOptions {
  configDir: string;
  hasApiKey: boolean;
  customMicrophone: boolean;
  /** "Abrir Touch Speaker" or a double click on the icon (spec janela-principal FR-UI-01, FR-UI-02). */
  onOpenWindow: (trigger: TrayOpenTrigger) => void;
  onQuit: () => void;
}

export class AppTray {
  private readonly tray: Tray;
  private theme: TaskbarTheme = readTaskbarTheme();
  private idleIcon = trayIcon(false, this.theme);
  private recordingIcon = trayIcon(true, this.theme);
  private recording = false;
  private hasApiKey: boolean;
  // The tray follows the Windows mode (taskbar); the pill follows the app mode by itself, through
  // prefers-color-scheme in tokens.css. Event-driven, no polling (spec design-system FR-DS-16, NFR-03).
  private readonly onThemeUpdated = () => this.setTaskbarTheme(readTaskbarTheme());

  constructor(private readonly opts: TrayOptions) {
    this.hasApiKey = opts.hasApiKey;
    this.tray = new Tray(this.idleIcon);
    // The single click stays free (spec janela-principal D2).
    this.tray.on('double-click', () => this.opts.onOpenWindow('tray_double_click'));
    this.setRecording(false);
    nativeTheme.on('updated', this.onThemeUpdated);
  }

  setRecording(recording: boolean): void {
    this.recording = recording;
    this.render();
  }

  /** The key was saved or removed on screen: status and tooltip change without restarting (FR-UI-24). */
  setGroqKeyState(hasApiKey: boolean): void {
    this.hasApiKey = hasApiKey;
    this.render();
  }

  destroy(): void {
    nativeTheme.off('updated', this.onThemeUpdated);
    this.tray.destroy();
  }

  private render(): void {
    if (this.tray.isDestroyed()) return;
    this.tray.setImage(this.recording ? this.recordingIcon : this.idleIcon);
    const status = !this.hasApiKey ? strings.trayNoKey : this.recording ? strings.trayRecording : strings.trayReady;
    this.tray.setToolTip(status);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: status, enabled: false },
        { label: this.opts.customMicrophone ? strings.trayMicCustom : strings.trayMicDefault, enabled: false },
        { type: 'separator' },
        { label: strings.trayOpenWindow, click: () => this.opts.onOpenWindow('tray_menu') },
        { label: strings.trayOpenConfig, click: () => void shell.openPath(this.opts.configDir) },
        { label: strings.trayQuit, click: this.opts.onQuit },
      ]),
    );
  }

  /** Redraws both icons in the variant of the new Windows mode, keeping "recording" if it is on (FR-DS-16). */
  private setTaskbarTheme(theme: TaskbarTheme): void {
    if (theme === this.theme || this.tray.isDestroyed()) return;
    this.theme = theme;
    this.idleIcon = trayIcon(false, theme);
    this.recordingIcon = trayIcon(true, theme);
    this.tray.setImage(this.recording ? this.recordingIcon : this.idleIcon);
  }
}
