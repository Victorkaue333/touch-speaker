// The theme choice in main (spec janela-principal FR-UI-39, FR-UI-40; Victor, 18/out/2026): read from
// config.json at startup and applied at once (index.ts passes nativeTheme.themeSource = …, so every window
// and the pill follow it, and the native title bar too); changed by theme:set, which writes config.json
// `theme` through the single queue (ConfigWriter) and applies the new value only after the write succeeded.
// A failed write keeps the theme in use and says so. The tray keeps following the taskbar (icon.ts).
// No `electron` import (TEST-018).
import type { ThemeResult } from '../shared/ipc';
import type { ThemePreference } from '../shared/theme';
import { type ConfigUpdateResult, type RawConfig, withTheme } from './config';
import type { LogPort } from './logger';

export interface ThemeSettingDeps {
  /** From config.json at startup. */
  inUse: ThemePreference;
  writer: { update(mutate: (raw: RawConfig) => RawConfig): Promise<ConfigUpdateResult> };
  /** nativeTheme.themeSource = theme, in the app. */
  apply(theme: ThemePreference): void;
  log: LogPort;
}

export class ThemeSetting {
  private inUse: ThemePreference;

  constructor(private readonly deps: ThemeSettingDeps) {
    this.inUse = deps.inUse;
    deps.apply(this.inUse);
  }

  current(): ThemePreference {
    return this.inUse;
  }

  async set(theme: ThemePreference): Promise<ThemeResult> {
    const written = await this.deps.writer.update((raw) => withTheme(raw, theme));
    if (!written.ok) {
      this.deps.log.error('theme_write_failed', { name: written.name });
      return { ok: false, code: 'write_failed', theme: this.inUse };
    }
    this.inUse = theme;
    this.deps.apply(theme);
    this.deps.log.info('theme_changed', { theme });
    return { ok: true, theme };
  }
}
