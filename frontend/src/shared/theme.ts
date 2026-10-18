// Theme of the windows (spec janela-principal FR-UI-39…42, design-system D4 revised by Victor on 18/out/2026):
// "system" follows the OS (the default), "light" and "dark" are the person's choice, saved in config.json
// `theme` and applied by main with nativeTheme.themeSource, so the pill follows too. The tray icon keeps
// following the taskbar (icon.ts readTaskbarTheme). The main window renderer mirrors resolveTheme/nextTheme
// (a classic script cannot import); TEST-018 covers these.

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some((t) => t === value);
}

/** The theme on screen: the choice, or the OS's when the choice is "system". */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

/** The toggle flips what is on screen: light → dark, dark → light (never back to "system"). */
export function nextTheme(current: ResolvedTheme): ResolvedTheme {
  return current === 'dark' ? 'light' : 'dark';
}
