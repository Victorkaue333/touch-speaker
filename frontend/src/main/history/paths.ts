// Where the history database lives (spec historico §9, decision M6 of 18/out/2026): a LOCAL folder, which
// never follows a roaming profile. Windows: %LOCALAPPDATA%\Touch Speaker\touch-speaker.db — Electron 44's
// app.getPath has no name for the Local folder (only 'appData', the Roaming one), so the Windows variable is
// read. Without it the history is unavailable: it never falls back to the Roaming folder (D14). macOS (only
// with spec distribuicao-windows-macos): app.getPath('appData') = ~/Library/Application Support.
// Pure: platform, environment and appData come in (TEST-016).
import * as path from 'node:path';

export const HISTORY_DIR_NAME = 'Touch Speaker';
export const HISTORY_FILE_NAME = 'touch-speaker.db';

export type HistoryLocation =
  | { ok: true; dir: string; file: string }
  | { ok: false; reason: 'no_localappdata' | 'unsupported_platform' };

export interface HistoryLocationInput {
  platform: NodeJS.Platform;
  env: Readonly<Record<string, string | undefined>>;
  /** app.getPath('appData'); used on macOS only. */
  appData: string;
}

export function historyLocation({ platform, env, appData }: HistoryLocationInput): HistoryLocation {
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA?.trim();
    if (!local || !path.win32.isAbsolute(local)) return { ok: false, reason: 'no_localappdata' };
    const dir = path.win32.join(local, HISTORY_DIR_NAME);
    return { ok: true, dir, file: path.win32.join(dir, HISTORY_FILE_NAME) };
  }
  if (platform === 'darwin') {
    const dir = path.posix.join(appData, HISTORY_DIR_NAME);
    return { ok: true, dir, file: path.posix.join(dir, HISTORY_FILE_NAME) };
  }
  return { ok: false, reason: 'unsupported_platform' };
}
