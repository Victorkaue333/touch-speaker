import { Menu, Tray, nativeTheme, shell, type MenuItemConstructorOptions, type NativeImage } from 'electron';
import type { TaskbarTheme } from '../shared/palette';
import { readTaskbarTheme, templateTrayIcon, trayIcon } from './icon';
import { type HookState, type PlatformProfile, type TrayAction, trayActions, trayStatus } from './platform';
import { stringsFor } from './strings';

export type TrayOpenTrigger = 'tray_menu' | 'tray_double_click';

export interface TrayOptions {
  profile: PlatformProfile;
  configDir: string;
  hasApiKey: boolean;
  customMicrophone: boolean;
  hook: HookState;
  /** Read each time the menu is built: whether the system blocks the microphone (macOS — FR-MAC-05). */
  microphoneBlocked: () => boolean;
  /** "Abrir Touch Speaker" or a double click on the icon (spec janela-principal FR-UI-01, FR-UI-02). */
  onOpenWindow: (trigger: TrayOpenTrigger) => void;
  /** The extra items of a hook that is not running or of a blocked microphone (FR-PKG-15, FR-MAC-02…05). */
  onAction: (action: TrayAction) => void;
  onQuit: () => void;
}

export class AppTray {
  private readonly tray: Tray;
  private readonly texts: ReturnType<typeof stringsFor>;
  private theme: TaskbarTheme = readTaskbarTheme();
  private idleIcon: NativeImage;
  private recordingIcon: NativeImage;
  private recording = false;
  private hasApiKey: boolean;
  private hook: HookState;
  private retryFailed = false;
  // Windows: the tray follows the Windows mode (taskbar); the pill follows the app mode by itself, through
  // prefers-color-scheme in tokens.css. Event-driven, no polling (spec design-system FR-DS-16, NFR-03).
  // macOS: a template image, which the system already paints for the menu bar — nothing to follow.
  private readonly onThemeUpdated = () => this.setTaskbarTheme(readTaskbarTheme());

  constructor(private readonly opts: TrayOptions) {
    this.texts = stringsFor(opts.profile.platform);
    this.hasApiKey = opts.hasApiKey;
    this.hook = opts.hook;
    this.idleIcon = this.icon(false);
    this.recordingIcon = this.icon(true);
    this.tray = new Tray(this.idleIcon);
    // The single click stays free (spec janela-principal D2).
    this.tray.on('double-click', () => this.opts.onOpenWindow('tray_double_click'));
    this.setRecording(false);
    if (!opts.profile.templateTrayIcon) nativeTheme.on('updated', this.onThemeUpdated);
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

  /** The keyboard hook started, or not (FR-PKG-15, FR-MAC-02); `retryFailed` brings "Reabrir" on macOS. */
  setHookState(hook: HookState, retryFailed: boolean): void {
    this.hook = hook;
    this.retryFailed = retryFailed;
    this.render();
  }

  /** Rebuilds the menu, e.g. after a permission may have changed. */
  refresh(): void {
    this.render();
  }

  destroy(): void {
    nativeTheme.off('updated', this.onThemeUpdated);
    this.tray.destroy();
  }

  private icon(recording: boolean): NativeImage {
    return this.opts.profile.templateTrayIcon ? templateTrayIcon(recording) : trayIcon(recording, this.theme);
  }

  private render(): void {
    if (this.tray.isDestroyed()) return;
    const t = this.texts;
    this.tray.setImage(this.recording ? this.recordingIcon : this.idleIcon);
    const status = {
      no_accessibility: t.trayNoAccessibility,
      hook_down: t.trayHookDown,
      no_key: t.trayNoKey,
      recording: t.trayRecording,
      ready: t.trayReady,
    }[trayStatus({ hook: this.hook, hasApiKey: this.hasApiKey, recording: this.recording })];
    this.tray.setToolTip(status);
    const labels: Record<TrayAction, string> = {
      open_accessibility: t.trayOpenAccessibility,
      retry_hook: t.trayRetry,
      relaunch: t.trayRelaunch,
      open_microphone: t.trayOpenMicrophone,
    };
    const actions = trayActions({
      profile: this.opts.profile,
      hook: this.hook,
      retryFailed: this.retryFailed,
      microphoneBlocked: this.opts.microphoneBlocked(),
    });
    const extra: MenuItemConstructorOptions[] = actions.map((action) => ({ label: labels[action], click: () => this.opts.onAction(action) }));
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: status, enabled: false },
        { label: this.opts.customMicrophone ? t.trayMicCustom : t.trayMicDefault, enabled: false },
        { type: 'separator' },
        ...extra,
        { label: t.trayOpenWindow, click: () => this.opts.onOpenWindow('tray_menu') },
        { label: t.trayOpenConfig, click: () => void shell.openPath(this.opts.configDir) },
        { label: t.trayQuit, click: this.opts.onQuit },
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
