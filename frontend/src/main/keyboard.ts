// Bridges the global keyboard hook (uiohook-napi) to the HotkeyController. Each event is reduced to
// hotkey / escape / other right here; key codes go no further (docs/Security-Guide.md §7).
import type { HotkeyController, KeyKind } from './hotkey';
import { ESCAPE_KEYCODE } from './keys';

/**
 * Starts the hook. The native module is loaded here, not at import time, so a missing or broken binary
 * throws inside the caller's try and the app opens without the hotkey (keyboard_hook_unavailable, SDD §19),
 * which the main window shows (spec janela-principal FR-UI-13).
 */
export function startKeyboardHook(hotkeyCode: number, controller: HotkeyController): () => void {
  // A runtime require on purpose (see above); the type still comes from the package.
  const { uIOhook } = require('uiohook-napi') as typeof import('uiohook-napi');
  const classify = (keycode: number): KeyKind =>
    keycode === hotkeyCode ? 'hotkey' : keycode === ESCAPE_KEYCODE ? 'escape' : 'other';

  uIOhook.on('keydown', (e) => controller.onKeyDown(classify(e.keycode)));
  uIOhook.on('keyup', (e) => controller.onKeyUp(classify(e.keycode)));
  try {
    uIOhook.start();
  } catch (err) {
    // "Tentar de novo" calls this again (FR-PKG-15, FR-MAC-03): no listener may be left behind twice.
    uIOhook.removeAllListeners();
    throw err;
  }

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    uIOhook.removeAllListeners();
    uIOhook.stop();
  };
}
