// Bridges the global keyboard hook (uiohook-napi) to the HotkeyController. Each event is reduced to
// hotkey / escape / other right here; key codes go no further (docs/Security-Guide.md §7).
import { uIOhook } from 'uiohook-napi';
import type { HotkeyController, KeyKind } from './hotkey';
import { ESCAPE_KEYCODE } from './keys';

export function startKeyboardHook(hotkeyCode: number, controller: HotkeyController): () => void {
  const classify = (keycode: number): KeyKind =>
    keycode === hotkeyCode ? 'hotkey' : keycode === ESCAPE_KEYCODE ? 'escape' : 'other';

  uIOhook.on('keydown', (e) => controller.onKeyDown(classify(e.keycode)));
  uIOhook.on('keyup', (e) => controller.onKeyUp(classify(e.keycode)));
  uIOhook.start();

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    uIOhook.removeAllListeners();
    uIOhook.stop();
  };
}
