// Tray icon (docs/DESIGN.md §6.2): pixels from icon-bitmap.ts, in the colour variant of the taskbar theme.
import { nativeImage, nativeTheme, type NativeImage } from 'electron';
import type { TaskbarTheme } from '../shared/palette';
import { renderTemplateTrayBitmap, renderTrayBitmap } from './icon-bitmap';

/**
 * Reads the Windows mode (taskbar and tray), which Windows keeps apart from the app mode that the windows
 * follow through `prefers-color-scheme`. Electron 44 exposes it as
 * `nativeTheme.shouldUseDarkColorsForSystemIntegratedUI` (win32, darwin); anything but a boolean means the
 * theme cannot be read, and the tray falls back to the neutral glyph (spec design-system D5, RISK-novo-5).
 */
export function readTaskbarTheme(): TaskbarTheme {
  const dark: unknown = nativeTheme.shouldUseDarkColorsForSystemIntegratedUI;
  if (typeof dark !== 'boolean') return 'unknown';
  return dark ? 'dark' : 'light';
}

function glyphImage(base: number, recording: boolean, theme: TaskbarTheme): NativeImage {
  const image = nativeImage.createFromBitmap(renderTrayBitmap(base, recording, theme), {
    width: base,
    height: base,
    scaleFactor: 1,
  });
  for (const scale of [1.5, 2]) {
    const size = base * scale;
    image.addRepresentation({ scaleFactor: scale, width: size, height: size, buffer: renderTrayBitmap(size, recording, theme) });
  }
  return image;
}

export function trayIcon(recording: boolean, theme: TaskbarTheme): NativeImage {
  return glyphImage(16, recording, theme);
}

/** macOS menu bar icon: a template image the system tints for light and dark (FR-MAC-09). 16 pt, @1x and @2x. */
export function templateTrayIcon(recording: boolean): NativeImage {
  const image = nativeImage.createFromBitmap(renderTemplateTrayBitmap(16, recording), { width: 16, height: 16, scaleFactor: 1 });
  image.addRepresentation({ scaleFactor: 2, width: 32, height: 32, buffer: renderTemplateTrayBitmap(32, recording) });
  image.setTemplateImage(true);
  return image;
}

/**
 * Icon of the main window (title bar and taskbar) until spec distribuicao-windows-macos brings the app's
 * .ico: the same glyph, larger (spec janela-principal §8).
 */
export function windowIcon(theme: TaskbarTheme): NativeImage {
  return glyphImage(32, false, theme);
}
