// Shared helper of the main window tests (not a test file: no `.test.` in the name). main-window.ts is a classic
// script (no exports), so a behaviour test cuts one top-level function out of the compiled main-window.js
// (`npm test` builds first) and evaluates it, with the globals it reads given by the test.
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const COMPILED = path.join(__dirname, '..', 'renderer', 'main-window', 'main-window.js');

/**
 * The top-level function `name` of the compiled main window script. `globals` become its free variables (a
 * constant, a fake `document`…); `prelude` declares module state it shares (`let themeSwitchToken = 0;`).
 */
export function rendererFunction<F>(name: string, globals: Record<string, unknown> = {}, prelude = ''): F {
  const js = readFileSync(COMPILED, 'utf8');
  const found = new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^\\}`, 'm').exec(js);
  if (!found) throw new Error(`function ${name} not found in main-window.js`);
  const names = Object.keys(globals);
  const factory = new Function(...names, `${prelude}\n${found[0]}\nreturn ${name};`) as (...values: unknown[]) => F;
  return factory(...names.map((key) => globals[key]));
}
