import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { type FilePort, nodeFilePort } from '../main/atomic-file';
import { type CipherPort, CredentialStore, GROQ_KEY_FILE, normalizeGroqKey } from '../main/credentials';

// TEST-007 — spec docs/spec/features/janela-principal.md §14 (FR-UI-18…23), ADR-08.
// Fake keys only: nothing here is a real Groq key.

/** A stand-in for safeStorage: XOR with a mask, so the file never holds the key as text. */
function fakeCipher(available = true): CipherPort & { available: boolean } {
  const mask = (data: Uint8Array) => Buffer.from(Array.from(data, (b) => b ^ 0xa5));
  return {
    available,
    isAvailable() {
      return this.available;
    },
    encrypt: (plain) => mask(Buffer.concat([Buffer.from('TS1:'), Buffer.from(plain, 'utf8')])),
    decrypt: (data) => {
      const plain = mask(data);
      if (!plain.subarray(0, 4).equals(Buffer.from('TS1:'))) throw new Error('decrypt failed');
      return plain.subarray(4).toString('utf8');
    },
  };
}

describe('normalizeGroqKey (FR-UI-19)', () => {
  it('trims the ends and keeps the rest', () => {
    assert.equal(normalizeGroqKey('  gsk_example_123  '), 'gsk_example_123');
    assert.equal(normalizeGroqKey('\tgsk_example\n'), 'gsk_example');
  });

  it('refuses empty, inner whitespace, control characters and more than 512 characters', () => {
    for (const bad of ['', '   ', ' abc def ', 'abc\tdef', 'abc\ndef', 'abc\u0007def', 'abc def', 'x'.repeat(513)]) {
      assert.equal(normalizeGroqKey(bad), null, JSON.stringify(bad.slice(0, 20)));
    }
    assert.equal(normalizeGroqKey('x'.repeat(512)), 'x'.repeat(512));
  });
});

describe('CredentialStore (FR-UI-18…23, ADR-08)', () => {
  let dir: string;
  const keyFile = () => path.join(dir, GROQ_KEY_FILE);
  const store = (opts: { envKey?: string; packaged?: boolean; cipher?: CipherPort; files?: FilePort } = {}) =>
    new CredentialStore({
      dir,
      cipher: opts.cipher ?? fakeCipher(),
      envKey: opts.envKey,
      packaged: opts.packaged ?? false,
      files: opts.files,
    });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-credentials-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('without file nor .env there is no key', () => {
    const s = store();
    assert.deepEqual(s.load(), { state: 'none' });
    assert.equal(s.current(), undefined);
  });

  it('without file, the .env key is used while unpackaged', () => {
    const s = store({ envKey: 'gsk_env_key' });
    assert.deepEqual(s.load(), { state: 'env' });
    assert.equal(s.current(), 'gsk_env_key');
  });

  it('the packaged app ignores the .env (FR-UI-23)', () => {
    const s = store({ envKey: 'gsk_env_key', packaged: true });
    assert.deepEqual(s.load(), { state: 'none' });
    assert.equal(s.current(), undefined);
  });

  it('saves encrypted, uses the key at once and reads it back on the next start', () => {
    const s = store({ envKey: 'gsk_env_key' });
    s.load();
    assert.deepEqual(s.save('  gsk_saved_key  '), { ok: true, state: 'stored' });
    assert.equal(s.current(), 'gsk_saved_key');
    assert.equal(s.state(), 'stored');

    const bytes = fs.readFileSync(keyFile());
    assert.ok(!bytes.toString('latin1').includes('gsk_saved_key'), 'the key is not in the file as text');
    assert.ok(!bytes.toString('utf8').includes('gsk_saved_key'));
    assert.ok(!fs.existsSync(`${keyFile()}.tmp`), 'no temporary file left');

    // The file comes before the .env (D1).
    const next = store({ envKey: 'gsk_env_key' });
    assert.deepEqual(next.load(), { state: 'stored' });
    assert.equal(next.current(), 'gsk_saved_key');
  });

  it('a second save replaces the key', () => {
    const s = store();
    s.save('gsk_first');
    s.save('gsk_second');
    const next = store();
    next.load();
    assert.equal(next.current(), 'gsk_second');
  });

  it('an invalid format writes nothing and keeps the previous key (FR-UI-19)', () => {
    const s = store();
    s.save('gsk_previous');
    const before = fs.readFileSync(keyFile());
    assert.deepEqual(s.save(' abc def '), { ok: false, code: 'invalid_format' });
    assert.deepEqual(fs.readFileSync(keyFile()), before);
    assert.equal(s.current(), 'gsk_previous');
    assert.equal(s.state(), 'stored');
  });

  it('without encryption it refuses and never writes the key anywhere (FR-UI-20)', () => {
    const s = store({ cipher: fakeCipher(false) });
    s.load();
    assert.deepEqual(s.save('gsk_plain'), { ok: false, code: 'encryption_unavailable' });
    assert.deepEqual(fs.readdirSync(dir), [], 'nothing was written');
    assert.equal(s.current(), undefined);
    assert.equal(s.state(), 'none');
  });

  it('a write that fails halfway keeps the previous file and the key in use', () => {
    const s = store();
    s.save('gsk_previous');
    const before = fs.readFileSync(keyFile());
    const failing = store({
      files: {
        ...nodeFilePort,
        renameSync: () => {
          throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
        },
      },
    });
    failing.load();
    assert.deepEqual(failing.save('gsk_new'), { ok: false, code: 'write_failed', name: 'ENOSPC' });
    assert.deepEqual(fs.readFileSync(keyFile()), before);
    assert.ok(!fs.existsSync(`${keyFile()}.tmp`));
    assert.equal(failing.current(), 'gsk_previous');
  });

  it('remove deletes the file and falls back to the .env, or to no key (FR-UI-21)', () => {
    const withEnv = store({ envKey: 'gsk_env_key' });
    withEnv.save('gsk_saved');
    assert.deepEqual(withEnv.remove(), { ok: true, state: 'env' });
    assert.ok(!fs.existsSync(keyFile()));
    assert.equal(withEnv.current(), 'gsk_env_key');

    const withoutEnv = store();
    withoutEnv.save('gsk_saved');
    assert.deepEqual(withoutEnv.remove(), { ok: true, state: 'none' });
    assert.equal(withoutEnv.current(), undefined);
  });

  it('a file that does not decrypt becomes unreadable, without throwing and without the .env (FR-UI-23)', () => {
    fs.writeFileSync(keyFile(), Buffer.from([1, 2, 3, 4, 5]));
    const s = store({ envKey: 'gsk_env_key' });
    const loaded = s.load();
    assert.equal(loaded.state, 'unreadable');
    assert.equal(typeof loaded.unreadableReason, 'string');
    assert.equal(s.current(), undefined);

    // Saving again fixes it.
    assert.deepEqual(s.save('gsk_again'), { ok: true, state: 'stored' });
    assert.equal(s.current(), 'gsk_again');
  });

  it('unreadable also when encryption is unavailable at startup or the content is not a key', () => {
    store().save('gsk_saved');
    assert.equal(store({ cipher: fakeCipher(false) }).load().state, 'unreadable');

    const cipher = fakeCipher();
    fs.writeFileSync(keyFile(), cipher.encrypt('not a key'));
    assert.deepEqual(store({ cipher }).load(), { state: 'unreadable', unreadableReason: 'invalid_content' });
  });

  it('no state or result carries the key (FR-UI-22)', () => {
    const s = store({ envKey: 'gsk_env_secret' });
    const results = [s.load(), s.save('gsk_saved_secret'), s.state(), s.remove(), s.state(), store().load()];
    const text = JSON.stringify(results);
    assert.ok(!text.includes('gsk_saved_secret'));
    assert.ok(!text.includes('gsk_env_secret'));
  });
});
