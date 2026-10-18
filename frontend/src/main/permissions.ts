// The permissions of the operating system (spec distribuicao-windows-macos §8, FR-MAC-02…05): Accessibility
// (keyboard hook and synthetic ⌘V) and Microphone on macOS; on Windows Accessibility does not apply. The app
// only reads these states or asks the system; it never stores them. Pure: the Electron calls come in through
// `PermissionsSystem` (systemPreferences, shell), so the choices are tested with fakes.
import type { SupportedPlatform } from './platform';

export type AccessibilityState = 'granted' | 'denied' | 'not-applicable';
export type MicrophoneState = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';
export type SettingsTarget = 'accessibility' | 'microphone';

/** Fixed System Settings / Windows Settings panels. Never a URL from a renderer (Security Guide §9). */
export const SETTINGS_URLS: Readonly<Record<SupportedPlatform, Partial<Record<SettingsTarget, string>>>> = {
  darwin: {
    accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  },
  win32: {
    microphone: 'ms-settings:privacy-microphone',
  },
};

/** The slice of Electron the port needs (systemPreferences and shell). */
export interface PermissionsSystem {
  isTrustedAccessibilityClient(prompt: boolean): boolean;
  getMediaAccessStatus(mediaType: 'microphone'): string;
  askForMediaAccess(mediaType: 'microphone'): Promise<boolean>;
  openExternal(url: string): Promise<void>;
}

export interface PermissionsPort {
  accessibility(): AccessibilityState;
  /** macOS: the system's own dialog that leads to the Accessibility list. Called once per launch at most. */
  promptAccessibility(): void;
  microphone(): MicrophoneState;
  /** macOS: the system's microphone dialog, only while `not-determined` (FR-MAC-04). Windows: no dialog. */
  requestMicrophone(): Promise<boolean>;
  openSettings(target: SettingsTarget): Promise<void>;
}

const MICROPHONE_STATES: readonly MicrophoneState[] = ['not-determined', 'granted', 'denied', 'restricted', 'unknown'];

function asMicrophoneState(value: string): MicrophoneState {
  return MICROPHONE_STATES.find((s) => s === value) ?? 'unknown';
}

export function createPermissions(platform: SupportedPlatform, system: PermissionsSystem): PermissionsPort {
  const mac = platform === 'darwin';
  const microphone = (): MicrophoneState => {
    try {
      return asMicrophoneState(system.getMediaAccessStatus('microphone'));
    } catch {
      return 'unknown';
    }
  };
  return {
    accessibility: () => {
      if (!mac) return 'not-applicable';
      try {
        return system.isTrustedAccessibilityClient(false) ? 'granted' : 'denied';
      } catch {
        return 'denied';
      }
    },
    promptAccessibility: () => {
      if (!mac) return;
      try {
        system.isTrustedAccessibilityClient(true);
      } catch {
        // No dialog: the menu bar still shows the state and the way to the settings.
      }
    },
    microphone,
    requestMicrophone: async () => {
      if (!mac) return microphone() !== 'denied';
      if (microphone() !== 'not-determined') return microphone() === 'granted';
      try {
        return await system.askForMediaAccess('microphone');
      } catch {
        return false;
      }
    },
    openSettings: async (target) => {
      const url = SETTINGS_URLS[platform][target];
      if (url) await system.openExternal(url);
    },
  };
}
