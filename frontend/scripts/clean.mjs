// Removes dist/ (tsc output) and release/ (electron-builder output) before packaging, so a file left by an
// older build can never end up in an artifact (spec distribuicao-windows-macos FR-PKG-09, NFR-novo-3).
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const dir of ['dist', 'release']) rmSync(join(root, dir), { recursive: true, force: true });
