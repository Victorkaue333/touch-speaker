// The rules of the package check (spec distribuicao-windows-macos FR-PKG-09, FR-PKG-10, FR-PKG-11; TEST-novo-3).
// Pure: it gets the list of files of the packaged app (inside app.asar and in app.asar.unpacked) and a way to
// read each one, and answers with the problems found. verify-package.mjs feeds it; package-rules.test.mjs
// tests it with `node --test`. Messages name the file and the rule, never the content that matched.

/**
 * The prefix of Groq keys, assembled at runtime on purpose: written as one literal it would make this file
 * (and every grep for leaked keys over the repository or a diff) match itself.
 */
export const GROQ_KEY_PREFIX = ['gsk', '_'].join('');

const DB_EXTENSIONS = ['.db', '.db-wal', '.db-shm', '.sqlite', '.sqlite3'];
const TOP_LEVEL_FORBIDDEN = ['src/', 'scripts/', 'docs/', 'build/', 'release/', 'dist/test/'];

/** The files that must be in every package: without them the app does not open or loses a feature silently. */
export function requiredFiles(target) {
  const { platform, arch } = target;
  return [
    { path: 'package.json' },
    { path: 'dist/main/index.js' },
    { path: 'dist/preload/pill.js' },
    { path: 'dist/preload/main-window.js' },
    { path: 'dist/renderer/pill.html' },
    { path: 'dist/renderer/main-window/index.html' },
    { prefix: 'dist/database/local/', suffix: '.sql', what: 'the history migrations (ADR-09)' },
    { path: `node_modules/uiohook-napi/prebuilds/${platform}-${arch}/uiohook-napi.node`, unpacked: true },
    { prefix: `node_modules/@koromix/koffi-${platform}-${arch}/`, suffix: '.node', unpacked: true, what: 'the koffi binary' },
  ];
}

function basename(p) {
  const i = p.lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}

/** Why `path` must not be in the package, or null when it may. */
export function forbiddenReason(path, { target, devDependencies = [] }) {
  const name = basename(path);
  if (name === '.env' || name.startsWith('.env.')) return '.env file';
  if (name.endsWith('.log')) return 'log file';
  if (name === 'config.json' && !path.startsWith('node_modules/')) return 'config.json (user data)';
  if (DB_EXTENSIONS.some((ext) => name.endsWith(ext))) return 'database file (user data)';
  if (name.endsWith('.map')) return 'source map (D16)';
  const top = TOP_LEVEL_FORBIDDEN.find((dir) => path.startsWith(dir));
  if (top) return `${top} is not part of the app`;
  for (const dep of devDependencies) {
    if (path.startsWith(`node_modules/${dep}/`)) return `devDependency ${dep}`;
  }
  const want = `${target.platform}-${target.arch}`;
  const prebuild = /^node_modules\/uiohook-napi\/prebuilds\/([^/]+)\//.exec(path);
  if (prebuild && prebuild[1] !== want) return `uiohook-napi binary for ${prebuild[1]}, not ${want}`;
  const koffi = /^node_modules\/@koromix\/koffi-([^/]+)\//.exec(path);
  if (koffi && koffi[1] !== want) return `koffi binary for ${koffi[1]}, not ${want}`;
  return null;
}

function matches(entry, rule) {
  if (rule.path !== undefined && entry.path !== rule.path) return false;
  if (rule.prefix !== undefined && !entry.path.startsWith(rule.prefix)) return false;
  if (rule.suffix !== undefined && !entry.path.endsWith(rule.suffix)) return false;
  return rule.unpacked === undefined || entry.unpacked === rule.unpacked;
}

/** True when the bytes hold the Groq key prefix anywhere. */
export function containsKeyPrefix(bytes) {
  return Buffer.from(bytes).includes(GROQ_KEY_PREFIX, 0, 'latin1');
}

/**
 * Checks a package. `entries`: [{ path: 'dist/main/index.js', unpacked: false }], paths with '/' relative to
 * the app root. `read(entry)` returns the bytes of a file. `target`: { platform: 'win32' | 'darwin', arch }.
 * Returns { problems: string[] } — empty when the package may be published.
 */
export function checkPackage({ entries, read, target, devDependencies = [] }) {
  const problems = [];
  for (const entry of entries) {
    const reason = forbiddenReason(entry.path, { target, devDependencies });
    if (reason) problems.push(`forbidden: ${entry.path} (${reason})`);
    if (entry.path.endsWith('.node') && !entry.unpacked) {
      problems.push(`native module inside app.asar: ${entry.path} (must be in app.asar.unpacked — FR-PKG-11)`);
    }
    if (containsKeyPrefix(read(entry))) problems.push(`Groq key prefix found in ${entry.path} (FR-PKG-10)`);
  }
  for (const rule of requiredFiles(target)) {
    if (!entries.some((entry) => matches(entry, rule))) {
      const where = rule.unpacked ? ' in app.asar.unpacked' : '';
      problems.push(`missing: ${rule.what ?? rule.path ?? rule.prefix}${where}`);
    }
  }
  return { problems };
}
