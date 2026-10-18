// The Windows paste driver: the Win32 calls of win32.ts (unchanged), behind PasteDriver. Loaded by index.ts
// only on Windows (platform.ts), so user32/kernel32/advapi32 are never touched on macOS (FR-MAC-01).
import type { PasteDriver } from './paste-driver';
import { initWin32, isForegroundWindowElevated, isSelfElevated, sendPasteShortcut } from './win32';

export interface Win32PasteDriver extends PasteDriver {
  /** Whether Touch Speaker itself runs elevated (then UIPI does not block it). Logged in app_ready. */
  readonly selfElevated: boolean;
}

/** Loads the Win32 bindings; throws if koffi cannot load them (the caller logs win32_unavailable). */
export function createWin32PasteDriver(): Win32PasteDriver {
  initWin32();
  const selfElevated = isSelfElevated();
  return {
    selfElevated,
    targetBlocksPaste: () => {
      if (selfElevated) return null;
      try {
        return isForegroundWindowElevated() ? 'elevated_target' : null;
      } catch {
        return null;
      }
    },
    sendPasteShortcut: () => {
      try {
        return sendPasteShortcut();
      } catch {
        return false;
      }
    },
  };
}
