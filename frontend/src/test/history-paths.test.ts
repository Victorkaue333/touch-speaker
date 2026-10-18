import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { historyLocation } from '../main/history/paths';

// TEST-016 — spec docs/spec/features/historico.md §9 (decision M6, D14; criterion 22, pure part).

const ROAMING = 'C:\\Users\\vic\\AppData\\Roaming';

describe('historyLocation (§9)', () => {
  it('Windows: %LOCALAPPDATA%\\Touch Speaker\\touch-speaker.db, never the Roaming folder', () => {
    const at = historyLocation({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\Users\\vic\\AppData\\Local', APPDATA: ROAMING }, appData: ROAMING });
    assert.deepEqual(at, {
      ok: true,
      dir: 'C:\\Users\\vic\\AppData\\Local\\Touch Speaker',
      file: 'C:\\Users\\vic\\AppData\\Local\\Touch Speaker\\touch-speaker.db',
    });
  });

  it('Windows without LOCALAPPDATA (or with a relative one): unavailable, no fallback to Roaming (D14)', () => {
    for (const env of [{}, { LOCALAPPDATA: '' }, { LOCALAPPDATA: '   ' }, { LOCALAPPDATA: 'AppData\\Local' }, { APPDATA: ROAMING }]) {
      assert.deepEqual(historyLocation({ platform: 'win32', env, appData: ROAMING }), { ok: false, reason: 'no_localappdata' }, JSON.stringify(env));
    }
  });

  it('macOS: app.getPath("appData") + Touch Speaker', () => {
    assert.deepEqual(historyLocation({ platform: 'darwin', env: {}, appData: '/Users/vic/Library/Application Support' }), {
      ok: true,
      dir: '/Users/vic/Library/Application Support/Touch Speaker',
      file: '/Users/vic/Library/Application Support/Touch Speaker/touch-speaker.db',
    });
  });

  it('another platform: unavailable', () => {
    assert.deepEqual(historyLocation({ platform: 'linux', env: {}, appData: '/home/vic/.config' }), { ok: false, reason: 'unsupported_platform' });
  });
});
