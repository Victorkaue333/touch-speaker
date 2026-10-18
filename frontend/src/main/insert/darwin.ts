// The macOS paste driver (spec distribuicao-windows-macos FR-MAC-06, FR-MAC-07; ADR-11): ⌘V posted as
// keyboard events through CoreGraphics, called with koffi as win32.ts does on Windows. Written from Apple's
// documentation of CGEventCreateKeyboardEvent, CGEventSetFlags, CGEventPost, CFRelease (Quartz Event
// Services / Core Foundation) and IsSecureEventInputEnabled (Carbon, HIToolbox). Nothing loads at import:
// the frameworks are opened on the first paste, and only on macOS (platform.ts).
import * as koffi from 'koffi';
import type { PasteDriver } from './paste-driver';

/** kVK_ANSI_V: the physical V key (same place on the US and ABNT2 layouts — RISK-novo-6). */
const KVK_ANSI_V = 0x09;
/** kCGEventFlagMaskCommand. */
const CG_EVENT_FLAG_MASK_COMMAND = 0x00100000n;
/** kCGHIDEventTap: the events enter where hardware events do. */
const CG_HID_EVENT_TAP = 0;

const FRAMEWORKS = '/System/Library/Frameworks';

interface Bindings {
  CGEventCreateKeyboardEvent: (source: null, virtualKey: number, keyDown: boolean) => unknown;
  CGEventSetFlags: (event: unknown, flags: bigint) => void;
  CGEventPost: (tap: number, event: unknown) => void;
  CFRelease: (ref: unknown) => void;
  IsSecureEventInputEnabled: () => number;
}

let bindings: Bindings | undefined;

function load(): Bindings {
  if (bindings) return bindings;
  const coreGraphics = koffi.load(`${FRAMEWORKS}/CoreGraphics.framework/CoreGraphics`);
  const coreFoundation = koffi.load(`${FRAMEWORKS}/CoreFoundation.framework/CoreFoundation`);
  const carbon = koffi.load(`${FRAMEWORKS}/Carbon.framework/Carbon`);
  bindings = {
    CGEventCreateKeyboardEvent: coreGraphics.func('void *CGEventCreateKeyboardEvent(void *source, uint16_t virtualKey, bool keyDown)'),
    CGEventSetFlags: coreGraphics.func('void CGEventSetFlags(void *event, uint64_t flags)'),
    CGEventPost: coreGraphics.func('void CGEventPost(uint32_t tap, void *event)'),
    CFRelease: coreFoundation.func('void CFRelease(void *cf)'),
    // Boolean (unsigned char) in Carbon.
    IsSecureEventInputEnabled: carbon.func('uint8_t IsSecureEventInputEnabled()'),
  };
  return bindings;
}

/** Posts V down and V up, both with the Command flag. false when an event could not be created. */
function postCommandV(): boolean {
  const b = load();
  const down = b.CGEventCreateKeyboardEvent(null, KVK_ANSI_V, true);
  const up = b.CGEventCreateKeyboardEvent(null, KVK_ANSI_V, false);
  try {
    if (!down || !up) return false;
    b.CGEventSetFlags(down, CG_EVENT_FLAG_MASK_COMMAND);
    b.CGEventSetFlags(up, CG_EVENT_FLAG_MASK_COMMAND);
    b.CGEventPost(CG_HID_EVENT_TAP, down);
    b.CGEventPost(CG_HID_EVENT_TAP, up);
    return true;
  } finally {
    if (down) b.CFRelease(down);
    if (up) b.CFRelease(up);
  }
}

/** True while macOS hides keystrokes from other apps (password fields, secure keyboard entry). */
function secureInputEnabled(): boolean {
  try {
    return load().IsSecureEventInputEnabled() !== 0;
  } catch {
    return false;
  }
}

/**
 * `isTrusted` = systemPreferences.isTrustedAccessibilityClient(false): checked at every paste, because the
 * permission can be revoked while the app is open (FR-MAC-07).
 */
export function createMacPasteDriver(isTrusted: () => boolean): PasteDriver {
  return {
    targetBlocksPaste: () => {
      if (!isTrusted()) return 'no_accessibility';
      return secureInputEnabled() ? 'secure_input' : null;
    },
    sendPasteShortcut: () => {
      try {
        return postCommandV();
      } catch {
        return false;
      }
    },
  };
}
