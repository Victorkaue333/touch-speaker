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
  /** Right Command (VC_META_R). macOS only: the default key there (spec distribuicao-windows-macos D5). */
  RightMeta: 3676,
} as const;

export type HotkeyName = keyof typeof HOTKEY_CODES;

/** Keys that only exist as a hotkey on one system (FR-MAC-11): RightMeta is the Windows key on a PC. */
const ONLY_ON: Partial<Record<HotkeyName, NodeJS.Platform>> = { RightMeta: 'darwin' };

/** The hotkeys accepted on `platform`, in the order of HOTKEY_CODES (the list on the Configurações screen). */
export function hotkeysFor(platform: NodeJS.Platform): HotkeyName[] {
  return (Object.keys(HOTKEY_CODES) as HotkeyName[]).filter((name) => {
    const only = ONLY_ON[name];
    return only === undefined || only === platform;
  });
}

/** A hotkey name valid on `platform` (BR-012: anything else falls back to the default of that system). */
export function isHotkeyName(value: unknown, platform: NodeJS.Platform = process.platform): value is HotkeyName {
  if (typeof value !== 'string' || !Object.hasOwn(HOTKEY_CODES, value)) return false;
  const only = ONLY_ON[value as HotkeyName];
  return only === undefined || only === platform;
}
