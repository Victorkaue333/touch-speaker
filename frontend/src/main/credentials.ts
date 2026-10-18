// The Groq key (ADR-08). Lives in memory only in the main process; on disk only encrypted by safeStorage
// (DPAPI on Windows) in groq-key.bin, written atomically; frontend/.env is a development fallback, read only
// while the app is not packaged. No function here returns the key except current(), which only the
// GroqTranscriber calls — never the log, never config.json, never an IPC response (FR-UI-22).
// No `electron` import: the cipher and the file system come in as ports (TEST-007).
import * as path from 'node:path';
import type { GroqKeyState } from '../shared/ipc';
import { errorName, type FilePort, nodeFilePort, writeFileAtomic } from './atomic-file';

export const GROQ_KEY_FILE = 'groq-key.bin';
export const MAX_GROQ_KEY_LENGTH = 512;

/** The part of Electron's safeStorage the store needs. */
export interface CipherPort {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}

export interface CredentialStoreOptions {
  /** The user data folder (%APPDATA%\Touch Speaker). */
  dir: string;
  cipher: CipherPort;
  /** GROQ_API_KEY from frontend/.env; ignored when `packaged`. */
  envKey: string | undefined;
  packaged: boolean;
  files?: FilePort;
}

export type KeySaveResult =
  | { ok: true; state: GroqKeyState }
  | { ok: false; code: 'invalid_format' | 'encryption_unavailable' | 'write_failed'; name?: string };

export type KeyRemoveResult = { ok: true; state: GroqKeyState } | { ok: false; code: 'write_failed'; name: string };

export type KeyLoadResult = { state: GroqKeyState; unreadableReason?: string };

/**
 * Format check of a key typed on screen (FR-UI-19): trims the ends, then 1 to 512 characters with no
 * whitespace or control character inside. Not Groq's format — a defensive limit of the IPC.
 * Returns the trimmed key, or null.
 */
export function normalizeGroqKey(raw: string): string | null {
  const key = raw.trim();
  if (key.length === 0 || key.length > MAX_GROQ_KEY_LENGTH) return null;
  if (/[\s\p{Cc}]/u.test(key)) return null;
  return key;
}

export class CredentialStore {
  private readonly file: string;
  private readonly files: FilePort;
  private readonly envKey: string | undefined;
  private key: string | undefined;
  private keyState: GroqKeyState = 'none';

  constructor(private readonly opts: CredentialStoreOptions) {
    this.file = path.join(opts.dir, GROQ_KEY_FILE);
    this.files = opts.files ?? nodeFilePort;
    // The .env is a development fallback only (FR-UI-23, ADR-08).
    this.envKey = !opts.packaged && opts.envKey ? opts.envKey : undefined;
  }

  /**
   * Startup order (FR-UI-23): groq-key.bin decrypted; else, only unpackaged, the .env key; else none.
   * A file that cannot be decrypted becomes `unreadable` — no key in use, the app opens normally.
   */
  load(): KeyLoadResult {
    if (!this.files.existsSync(this.file)) {
      this.useFallback();
      return { state: this.keyState };
    }
    try {
      if (!this.opts.cipher.isAvailable()) return this.markUnreadable('encryption_unavailable');
      const key = normalizeGroqKey(this.opts.cipher.decrypt(this.files.readFileSync(this.file)));
      if (key === null) return this.markUnreadable('invalid_content');
      this.key = key;
      this.keyState = 'stored';
      return { state: this.keyState };
    } catch (err) {
      return this.markUnreadable(errorName(err));
    }
  }

  /** The key in use, for the GroqTranscriber only. */
  current(): string | undefined {
    return this.key;
  }

  state(): GroqKeyState {
    return this.keyState;
  }

  /** Saves a key typed on screen (FR-UI-18…20). Never writes it in plain text, anywhere. */
  save(raw: string): KeySaveResult {
    const key = normalizeGroqKey(raw);
    if (key === null) return { ok: false, code: 'invalid_format' };
    if (!this.opts.cipher.isAvailable()) return { ok: false, code: 'encryption_unavailable' };
    let data: Buffer;
    try {
      data = this.opts.cipher.encrypt(key);
    } catch (err) {
      return { ok: false, code: 'write_failed', name: errorName(err) };
    }
    try {
      this.files.mkdirSync(this.opts.dir);
      writeFileAtomic(this.file, data, this.files, 0o600);
    } catch (err) {
      return { ok: false, code: 'write_failed', name: errorName(err) };
    }
    this.key = key;
    this.keyState = 'stored';
    return { ok: true, state: this.keyState };
  }

  /** Deletes groq-key.bin (FR-UI-21); the .env key (development) or none takes over. */
  remove(): KeyRemoveResult {
    try {
      this.files.rmSync(this.file);
    } catch (err) {
      return { ok: false, code: 'write_failed', name: errorName(err) };
    }
    this.useFallback();
    return { ok: true, state: this.keyState };
  }

  private useFallback(): void {
    this.key = this.envKey;
    this.keyState = this.envKey ? 'env' : 'none';
  }

  private markUnreadable(reason: string): KeyLoadResult {
    this.key = undefined;
    this.keyState = 'unreadable';
    return { state: this.keyState, unreadableReason: reason };
  }
}
