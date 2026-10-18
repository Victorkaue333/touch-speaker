// TEST-novo-3 (spec distribuicao-windows-macos §14): the package check refuses forbidden files, native modules
// inside the asar, binaries of another system, missing required files and any file with the Groq key prefix.
// Runs in `npm test` with node --test, next to the compiled tests.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkPackage, containsKeyPrefix, forbiddenReason, GROQ_KEY_PREFIX } from './package-rules.mjs';

const WIN = { platform: 'win32', arch: 'x64' };
const MAC = { platform: 'darwin', arch: 'arm64' };

function cleanPackage(target) {
  const { platform, arch } = target;
  return [
    { path: 'package.json', unpacked: false },
    { path: 'dist/main/index.js', unpacked: false },
    { path: 'dist/preload/pill.js', unpacked: false },
    { path: 'dist/preload/main-window.js', unpacked: false },
    { path: 'dist/renderer/pill.html', unpacked: false },
    { path: 'dist/renderer/main-window/index.html', unpacked: false },
    { path: 'dist/database/local/0001_init.sql', unpacked: false },
    { path: `node_modules/uiohook-napi/prebuilds/${platform}-${arch}/uiohook-napi.node`, unpacked: true },
    { path: `node_modules/@koromix/koffi-${platform}-${arch}/${platform}_${arch}/koffi.node`, unpacked: true },
    { path: 'node_modules/koffi/package.json', unpacked: false },
  ];
}

const run = (entries, target = WIN, contents = {}) =>
  checkPackage({
    entries,
    target,
    devDependencies: ['electron', 'electron-builder', 'typescript', '@types/node'],
    read: (entry) => Buffer.from(contents[entry.path] ?? 'ok'),
  }).problems;

describe('package-rules — the package check (FR-PKG-09, FR-PKG-10, FR-PKG-11)', () => {
  it('a clean package passes, on Windows and on macOS', () => {
    assert.deepEqual(run(cleanPackage(WIN), WIN), []);
    assert.deepEqual(run(cleanPackage(MAC), MAC), []);
  });

  it('refuses .env, logs, config.json, databases, dist/test, source maps, src/, scripts/ and docs/', () => {
    const forbidden = [
      '.env',
      'dist/.env.local',
      'dist/main/main.log',
      'config.json',
      'dist/touch-speaker.db',
      'touch-speaker.db-wal',
      'dist/test/config.test.js',
      'dist/main/index.js.map',
      'src/main/index.ts',
      'scripts/start.mjs',
      'docs/PRD.md',
    ];
    for (const path of forbidden) {
      const problems = run([...cleanPackage(WIN), { path, unpacked: false }]);
      assert.equal(problems.length, 1, path);
      assert.match(problems[0] ?? '', /^forbidden: /, path);
    }
  });

  it('refuses devDependencies', () => {
    for (const path of ['node_modules/electron/index.js', 'node_modules/typescript/lib/tsc.js', 'node_modules/@types/node/fs.d.ts']) {
      assert.match(run([...cleanPackage(WIN), { path, unpacked: false }]).join(), /devDependency/, path);
    }
  });

  it('refuses binaries of another system or architecture (FR-PKG-11)', () => {
    assert.match(forbiddenReason('node_modules/uiohook-napi/prebuilds/darwin-arm64/uiohook-napi.node', { target: WIN }) ?? '', /darwin-arm64/);
    assert.match(forbiddenReason('node_modules/uiohook-napi/prebuilds/darwin-x64/uiohook-napi.node', { target: MAC }) ?? '', /darwin-x64/);
    assert.match(forbiddenReason('node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node', { target: MAC }) ?? '', /win32-x64/);
    assert.equal(forbiddenReason('node_modules/uiohook-napi/prebuilds/win32-x64/uiohook-napi.node', { target: WIN }), null);
  });

  it('refuses a native module left inside app.asar', () => {
    const entries = cleanPackage(WIN).map((e) => (e.path.endsWith('koffi.node') ? { ...e, unpacked: false } : e));
    const problems = run(entries);
    assert.ok(problems.some((p) => p.startsWith('native module inside app.asar')));
    assert.ok(problems.some((p) => p.startsWith('missing: the koffi binary')));
  });

  it('refuses a package without a required file (the migrations, a native binary, the entry point)', () => {
    for (const path of ['dist/database/local/0001_init.sql', 'dist/main/index.js', 'node_modules/uiohook-napi/prebuilds/win32-x64/uiohook-napi.node']) {
      const problems = run(cleanPackage(WIN).filter((e) => e.path !== path));
      assert.equal(problems.length, 1, path);
      assert.match(problems[0] ?? '', /^missing: /, path);
    }
  });

  it('refuses an allowed file that holds the Groq key prefix, without echoing the content (FR-PKG-10, AC 10)', () => {
    const secret = `${GROQ_KEY_PREFIX}${'A'.repeat(52)}`;
    const problems = run(cleanPackage(WIN), WIN, { 'dist/main/index.js': `const k = "${secret}";` });
    assert.deepEqual(problems, ['Groq key prefix found in dist/main/index.js (FR-PKG-10)']);
    assert.ok(!problems.join().includes(secret));
  });

  it('finds the prefix in binary bytes too', () => {
    assert.equal(containsKeyPrefix(Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(GROQ_KEY_PREFIX), Buffer.from([255])])), true);
    assert.equal(containsKeyPrefix(Buffer.from('gsk', 'latin1')), false);
  });

  it('config.json inside a dependency is not user data', () => {
    assert.equal(forbiddenReason('node_modules/some-lib/config.json', { target: WIN }), null);
  });
});
