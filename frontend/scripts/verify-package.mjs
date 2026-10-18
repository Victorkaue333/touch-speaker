// Package check (spec distribuicao-windows-macos FR-PKG-09…11; RISK-novo-5). Lists every file of the packaged
// app — inside resources/app.asar and in resources/app.asar.unpacked — and fails when one is forbidden
// (.env, logs, config.json, database, dist/test, source maps, devDependencies, binaries of another system),
// when a required one is missing, or when any file holds the Groq key prefix. The rules live in
// package-rules.mjs (tested). Only the app's own content is scanned: the Electron binaries come from the
// pinned electron package, not from this repository.
//
// Two ways in:
// - electron-builder `afterPack` hook (electron-builder.yml): runs on the unpacked app before the installer,
//   the .dmg or the .zip is written, so a bad package never becomes an artifact;
// - by hand: `node scripts/verify-package.mjs [folder]` (default: release/) checks every app found there.
// Each run also writes release/package-files-<platform>-<arch>.txt, the file list to compare between two
// builds of the same commit (NFR-novo-3).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkPackage } from './package-rules.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- app.asar, read by hand (the format is a small JSON header in a Chromium pickle, then the bytes) ----

function readAsarHeader(file) {
  const fd = openSync(file, 'r');
  try {
    const sizeBuf = Buffer.alloc(8);
    readSync(fd, sizeBuf, 0, 8, 0);
    const headerPickleSize = sizeBuf.readUInt32LE(4);
    const headerBuf = Buffer.alloc(headerPickleSize);
    readSync(fd, headerBuf, 0, headerPickleSize, 8);
    const jsonLength = headerBuf.readUInt32LE(4);
    const header = JSON.parse(headerBuf.subarray(8, 8 + jsonLength).toString('utf8'));
    return { header, dataOffset: 8 + headerPickleSize };
  } finally {
    closeSync(fd);
  }
}

/** Every file of app.asar (packed and unpacked), with a reader for its bytes. */
function asarEntries(asarFile) {
  const { header, dataOffset } = readAsarHeader(asarFile);
  const unpackedDir = `${asarFile}.unpacked`;
  const entries = [];
  const walk = (node, prefix) => {
    for (const [name, child] of Object.entries(node.files ?? {})) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (child.files) walk(child, path);
      else if (child.link === undefined) entries.push({ path, unpacked: child.unpacked === true, size: child.size, offset: child.offset });
    }
  };
  walk(header, '');
  const read = (entry) => {
    if (entry.unpacked) return readFileSync(join(unpackedDir, ...entry.path.split('/')));
    const fd = openSync(asarFile, 'r');
    try {
      const bytes = Buffer.alloc(entry.size);
      readSync(fd, bytes, 0, entry.size, dataOffset + Number(entry.offset));
      return bytes;
    } finally {
      closeSync(fd);
    }
  };
  return { entries, read };
}

function devDependencies() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  return Object.keys(pkg.devDependencies ?? {});
}

/** Checks one app.asar for one target; throws with the list of problems. */
export function verifyAsar(asarFile, target) {
  const { entries, read } = asarEntries(asarFile);
  const { problems } = checkPackage({ entries, read, target, devDependencies: devDependencies() });
  const natives = entries.filter((e) => e.path.endsWith('.node')).map((e) => e.path);
  const listing = entries.map((e) => `${e.unpacked ? 'U' : 'A'} ${e.path}`).sort().join('\n') + '\n';
  const listFile = join(root, 'release', `package-files-${target.platform}-${target.arch}.txt`);
  if (existsSync(dirname(listFile))) writeFileSync(listFile, listing, 'utf8');
  const label = `${target.platform}-${target.arch}`;
  if (problems.length > 0) {
    throw new Error(`verify-package (${label}): ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}`);
  }
  console.log(`verify-package (${label}): OK — ${entries.length} files, native: ${natives.join(', ')}`);
  return { files: entries.length, natives };
}

function findAsars(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === 'app.asar') found.push(full);
    else if (!name.endsWith('.asar.unpacked') && statSync(full, { throwIfNoEntry: false })?.isDirectory()) findAsars(full, found);
  }
  return found;
}

/** win-unpacked → win32-x64; mac-arm64/…/Touch Speaker.app → darwin-arm64 (the folders electron-builder writes). */
function targetFromPath(asarFile, base) {
  const first = relative(base, asarFile).split(sep)[0] ?? '';
  if (first === 'win-unpacked') return { platform: 'win32', arch: 'x64' };
  const mac = /^mac(?:-(arm64|x64|universal))?$/.exec(first);
  if (mac) return { platform: 'darwin', arch: mac[1] ?? 'x64' };
  const win = /^win-(arm64|ia32)-unpacked$/.exec(first);
  if (win) return { platform: 'win32', arch: win[1] };
  throw new Error(`verify-package: cannot tell the target of ${asarFile}`);
}

// electron-builder's Arch enum (builder-util): ia32 0, x64 1, armv7l 2, arm64 3, universal 4.
const ARCH_NAMES = ['ia32', 'x64', 'armv7l', 'arm64', 'universal'];

/** afterPack hook: context.appOutDir is win-unpacked or mac-arm64. */
export default async function afterPack(context) {
  const arch = typeof context.arch === 'number' ? ARCH_NAMES[context.arch] : String(context.arch);
  const target = { platform: context.electronPlatformName, arch };
  const asars = findAsars(context.appOutDir);
  if (asars.length !== 1) throw new Error(`verify-package: expected one app.asar in ${context.appOutDir}, found ${asars.length}`);
  verifyAsar(asars[0], target);
}

const runDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (runDirectly) {
  const base = resolve(process.argv[2] ?? join(root, 'release'));
  try {
    const asars = existsSync(base) ? findAsars(base) : [];
    if (asars.length === 0) throw new Error(`verify-package: no app.asar under ${base} — run npm run dist:win or dist:mac first`);
    for (const asar of asars) verifyAsar(asar, targetFromPath(asar, base));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
