// Key codes reported by libuiohook (the `VC_*` virtual codes exposed by uiohook-napi as UiohookKey).
// Kept as plain numbers so the hotkey logic can be tested without loading the native module.

export const ESCAPE_KEYCODE = 1;

export const HOTKEY_CODES = {
  RightCtrl: 3613,
  RightAlt: 3640,
  RightShift: 54,
  CapsLock: 58,
  F13: 91,
  F14: 92,
  F15: 93,
  F16: 99,
  F17: 100,
  F18: 101,
  F19: 102,
  F20: 103,
  F21: 104,
  F22: 105,
  F23: 106,
  F24: 107,
} as const;

export type HotkeyName = keyof typeof HOTKEY_CODES;

export function isHotkeyName(value: unknown): value is HotkeyName {
  return typeof value === 'string' && Object.hasOwn(HOTKEY_CODES, value);
}
