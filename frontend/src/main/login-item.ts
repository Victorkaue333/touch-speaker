// "Iniciar com o Windows" (spec janela-principal FR-UI-36, FR-UI-37): the login item of the system — the
// user's Run key on Windows — read and written through app.getLoginItemSettings / setLoginItemSettings. It is
// state of the system, not of config.json. Only for the packaged app: unpackaged, the item would point to
// electron.exe without the app (RISK-029), so it answers `unavailable` without touching the system.
// `app` comes in as a port (TEST-009).
import type { LoginItemResult, LoginItemView } from '../shared/ipc';

export interface LoginItemSystemState {
  openAtLogin: boolean;
  /** Windows: set to open at login and not deactivated in Task Manager → Startup apps. */
  executableWillLaunchAtLogin?: boolean;
}

export interface LoginItemApp {
  readonly isPackaged: boolean;
  getLoginItemSettings(): LoginItemSystemState;
  setLoginItemSettings(settings: { openAtLogin: boolean }): void;
}

export type LoginItemSetOutcome = { result: LoginItemResult; name?: string };

export class LoginItem {
  constructor(
    private readonly app: LoginItemApp,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  get available(): boolean {
    return this.app.isPackaged;
  }

  /** Re-read every time Configurações shows, so a change made outside the app shows up (spec §5.8). */
  read(): LoginItemView {
    if (!this.available) return { available: false, enabled: false };
    try {
      return { available: true, enabled: this.readEnabled() };
    } catch {
      return { available: true, enabled: false };
    }
  }

  /** Writes the item now, re-reads it and answers with the real state (FR-UI-37). */
  set(enabled: boolean): LoginItemSetOutcome {
    if (!this.available) return { result: { ok: false, code: 'unavailable', enabled: false } };
    let name: string | undefined;
    try {
      // On Windows `enabled` defaults to true: switching on also undoes a deactivation in Task Manager.
      this.app.setLoginItemSettings({ openAtLogin: enabled });
    } catch (err) {
      name = err instanceof Error ? err.name : 'unknown';
    }
    let actual: boolean;
    try {
      actual = this.readEnabled();
    } catch (err) {
      return { result: { ok: false, code: 'login_item_failed', enabled: !enabled }, name: err instanceof Error ? err.name : 'unknown' };
    }
    if (name === undefined && actual === enabled) return { result: { ok: true, enabled: actual } };
    return { result: { ok: false, code: 'login_item_failed', enabled: actual }, name: name ?? 'not_applied' };
  }

  /**
   * Windows reports a deactivation in Task Manager only in executableWillLaunchAtLogin (Electron 44), so it
   * is the real state there; elsewhere openAtLogin.
   */
  private readEnabled(): boolean {
    const state = this.app.getLoginItemSettings();
    if (this.platform === 'win32' && typeof state.executableWillLaunchAtLogin === 'boolean') {
      return state.executableWillLaunchAtLogin;
    }
    return state.openAtLogin;
  }
}
