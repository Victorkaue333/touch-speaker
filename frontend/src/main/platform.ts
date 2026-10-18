// The platform boundary (spec distribuicao-windows-macos §8, ADR-11): what differs between Windows and macOS
// is decided here, once, at startup. Pure — no `electron`, no native module — so `node:test` covers it
// (TEST-novo-1). The drivers themselves (insert/win32.ts, insert/darwin.ts) are chosen here and built by the
// caller through factories, so the code of the other system is never loaded (FR-MAC-01).
import type { PasteDriver } from './insert/paste-driver';

export type SupportedPlatform = 'win32' | 'darwin';

export interface PlatformProfile {
  platform: SupportedPlatform;
  /** macOS: the keyboard hook only starts once the app is a trusted Accessibility client (FR-MAC-02). */
  hookNeedsAccessibility: boolean;
  /** macOS: a minimal application menu with the Edit roles, so ⌘C/⌘V/⌘X/⌘A/⌘Z work in the app (FR-MAC-12). */
  editMenu: boolean;
  /** macOS: the menu bar icon is a template image, painted by the system for light and dark (FR-MAC-09). */
  templateTrayIcon: boolean;
  /** macOS: no Dock icon while the app lives in the menu bar (FR-MAC-08). */
  hideDock: boolean;
  /** macOS: the pill is a panel that also shows over full-screen apps (FR-MAC-13). */
  pillOverFullScreen: boolean;
}

export class UnsupportedPlatformError extends Error {
  constructor(readonly platform: string) {
    super(`Touch Speaker runs on Windows and macOS only, not on "${platform}"`);
    this.name = 'UnsupportedPlatformError';
  }
}

/** What the app does differently on `platform`. Anything but Windows or macOS is refused (ADR-11). */
export function selectPlatform(platform: NodeJS.Platform | string): PlatformProfile {
  if (platform === 'win32') {
    return { platform, hookNeedsAccessibility: false, editMenu: false, templateTrayIcon: false, hideDock: false, pillOverFullScreen: false };
  }
  if (platform === 'darwin') {
    return { platform, hookNeedsAccessibility: true, editMenu: true, templateTrayIcon: true, hideDock: true, pillOverFullScreen: true };
  }
  throw new UnsupportedPlatformError(platform);
}

export interface PasteDriverFactories {
  win32: () => PasteDriver;
  darwin: () => PasteDriver;
}

/** Builds only the paste driver of the profile's system: the other factory is never called. */
export function pasteDriverFor(profile: PlatformProfile, factories: PasteDriverFactories): PasteDriver {
  return factories[profile.platform]();
}

/** A driver that never pastes: the text stays in the clipboard (C3) when the system driver did not load. */
export const COPY_ONLY_DRIVER: PasteDriver = {
  targetBlocksPaste: () => null,
  sendPasteShortcut: () => false,
};

// ---- The keyboard hook and its permission (FR-PKG-15, FR-MAC-02, FR-MAC-03) ----------------------------

/** ok = listening; needs_accessibility = not started for lack of permission; unavailable = failed to start. */
export type HookState = 'ok' | 'needs_accessibility' | 'unavailable';

/** Whether to call uIOhook.start() now. On macOS never without Accessibility: libuiohook would ask again each time. */
export function shouldStartHook(profile: PlatformProfile, accessibilityGranted: boolean): boolean {
  return !profile.hookNeedsAccessibility || accessibilityGranted;
}

export interface TrayStatusInput {
  hook: HookState;
  hasApiKey: boolean;
  recording: boolean;
}

export type TrayStatus = 'no_accessibility' | 'hook_down' | 'no_key' | 'recording' | 'ready';

/** The status line of the tray / menu bar: a hook that is not running comes first, never "pronto" (C4). */
export function trayStatus({ hook, hasApiKey, recording }: TrayStatusInput): TrayStatus {
  if (hook === 'needs_accessibility') return 'no_accessibility';
  if (hook === 'unavailable') return 'hook_down';
  if (!hasApiKey) return 'no_key';
  return recording ? 'recording' : 'ready';
}

export type TrayAction = 'open_accessibility' | 'retry_hook' | 'relaunch' | 'open_microphone';

export interface TrayActionsInput {
  profile: PlatformProfile;
  hook: HookState;
  /** A retry already failed: macOS may only see the new permission after the app opens again (FR-MAC-03). */
  retryFailed: boolean;
  microphoneBlocked: boolean;
}

/** The extra items of the tray / menu bar for the current state, in menu order. */
export function trayActions({ profile, hook, retryFailed, microphoneBlocked }: TrayActionsInput): TrayAction[] {
  const actions: TrayAction[] = [];
  if (hook === 'needs_accessibility') actions.push('open_accessibility');
  if (hook !== 'ok') actions.push('retry_hook');
  if (hook !== 'ok' && retryFailed && profile.platform === 'darwin') actions.push('relaunch');
  if (microphoneBlocked && profile.platform === 'darwin') actions.push('open_microphone');
  return actions;
}
