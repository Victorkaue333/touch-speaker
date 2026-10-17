// Copies the non-TypeScript renderer files (HTML, CSS) next to the compiled JS.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'src', 'renderer');
const to = join(root, 'dist', 'renderer');

mkdirSync(to, { recursive: true });
for (const name of readdirSync(from)) {
  if (['.html', '.css'].includes(extname(name))) cpSync(join(from, name), join(to, name));
}
