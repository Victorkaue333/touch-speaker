// Atomic file writes: a temporary file in the same folder, then a rename over the target, so a crash or
// a full disk never leaves a half-written groq-key.bin or config.json (spec janela-principal FR-UI-18,
// FR-UI-29). The file system comes in as a port so the tests can make a write fail halfway.
import * as nodeFs from 'node:fs';

export interface FilePort {
  existsSync(path: string): boolean;
  readFileSync(path: string): Buffer;
  writeFileSync(path: string, data: string | Uint8Array, options: { mode?: number }): void;
  renameSync(from: string, to: string): void;
  rmSync(path: string): void;
  mkdirSync(path: string): void;
}

export const nodeFilePort: FilePort = {
  existsSync: (p) => nodeFs.existsSync(p),
  readFileSync: (p) => nodeFs.readFileSync(p),
  // flush: the bytes reach the disk before the rename makes them visible.
  writeFileSync: (p, data, { mode }) => nodeFs.writeFileSync(p, data, { mode, flush: true }),
  renameSync: (from, to) => nodeFs.renameSync(from, to),
  rmSync: (p) => nodeFs.rmSync(p, { force: true }),
  mkdirSync: (p) => void nodeFs.mkdirSync(p, { recursive: true }),
};

/** Writes `data` to `<file>.tmp` and renames it over `file`. On failure the old file is untouched. */
export function writeFileAtomic(file: string, data: string | Uint8Array, fs: FilePort = nodeFilePort, mode?: number): void {
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, data, { mode });
    fs.renameSync(tmp, file);
  } catch (err) {
    try {
      fs.rmSync(tmp);
    } catch {
      // The temporary file is harmless; the error that matters is the one below.
    }
    throw err;
  }
}

/** Error metadata safe for the log: the errno code (EPERM, ENOSPC…) or the error name, never a message. */
export function errorName(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    return typeof code === 'string' ? code : err.name;
  }
  return 'unknown';
}
