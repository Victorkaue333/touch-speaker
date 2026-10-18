// Copies the non-TypeScript files next to the compiled JS: the renderer's (HTML, CSS, licences, fonts/ with its
// licence) — the pill's at the top of src/renderer, the main window's in src/renderer/main-window (spec
// janela-principal §8). The main window's Lucide icons are inline in index.html; their ISC licence,
// LICENSE-lucide.txt, travels next to it (docs/DESIGN.md §11). And the SQLite migrations (database/local).
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'src', 'renderer');
const to = join(root, 'dist', 'renderer');

/** Copies the .html, .css and .txt (licences) of one folder (not recursive). */
function copyPages(source, target) {
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(source)) {
    if (['.html', '.css', '.txt'].includes(extname(name))) cpSync(join(source, name), join(target, name));
  }
}

copyPages(from, to);
if (existsSync(join(from, 'main-window'))) copyPages(join(from, 'main-window'), join(to, 'main-window'));
// Inter and its OFL licence travel together (ADR-12).
if (existsSync(join(from, 'fonts'))) cpSync(join(from, 'fonts'), join(to, 'fonts'), { recursive: true });

// The SQLite migrations of the history live at the repository root, outside frontend/ (spec historico D11):
// database/local/NNNN_*.sql → dist/database/local/, where src/main/history/migrations.ts reads them.
const migrationsFrom = join(root, '..', 'database', 'local');
const migrationsTo = join(root, 'dist', 'database', 'local');
mkdirSync(migrationsTo, { recursive: true });
for (const name of readdirSync(migrationsFrom)) {
  if (extname(name) === '.sql') cpSync(join(migrationsFrom, name), join(migrationsTo, name));
}
