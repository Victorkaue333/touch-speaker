import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderTemplateTrayBitmap } from '../main/icon-bitmap';
import type { PasteDriver } from '../main/insert/paste-driver';
import { createPermissions, type PermissionsSystem, SETTINGS_URLS } from '../main/permissions';
import {
  COPY_ONLY_DRIVER,
  pasteDriverFor,
  selectPlatform,
  shouldStartHook,
  trayActions,
  trayStatus,
  UnsupportedPlatformError,
} from '../main/platform';

// TEST-novo-1 — spec distribuicao-windows-macos §14 (FR-MAC-01, FR-MAC-02, FR-MAC-03, FR-MAC-08, FR-MAC-09,
// FR-MAC-12, FR-MAC-13, FR-PKG-15). The platform boundary is pure; the drivers come in as fakes.

const WIN = selectPlatform('win32');
const MAC = selectPlatform('darwin');

function fakeDriver(name: string): PasteDriver & { name: string } {
  return { name, targetBlocksPaste: () => null, sendPasteShortcut: () => true };
}

describe('selectPlatform', () => {
  it('Windows keeps the Fase 1 behaviour: no Accessibility gate, no app menu, colour tray icon, Dock n/a', () => {
    assert.deepEqual(WIN, {
      platform: 'win32',
      hookNeedsAccessibility: false,
      editMenu: false,
      templateTrayIcon: false,
      hideDock: false,
      pillOverFullScreen: false,
    });
  });

  it('macOS: Accessibility before the hook, Edit menu, template icon, no Dock, pill over full screen', () => {
    assert.deepEqual(MAC, {
      platform: 'darwin',
      hookNeedsAccessibility: true,
      editMenu: true,
      templateTrayIcon: true,
      hideDock: true,
      pillOverFullScreen: true,
    });
  });

  it('any other system is refused with a clear error (ADR-11)', () => {
    for (const other of ['linux', 'freebsd', 'android']) {
      assert.throws(() => selectPlatform(other), (err: unknown) => err instanceof UnsupportedPlatformError && /Windows and macOS/.test(err.message));
    }
  });
});

describe('pasteDriverFor — only the driver of the system is built (FR-MAC-01)', () => {
  it('on macOS the Windows factory (user32, kernel32, advapi32) is never called', () => {
    const calls: string[] = [];
    const driver = pasteDriverFor(MAC, {
      win32: () => {
        calls.push('win32');
        return fakeDriver('win32');
      },
      darwin: () => {
        calls.push('darwin');
        return fakeDriver('darwin');
      },
    });
    assert.deepEqual(calls, ['darwin']);
    assert.equal((driver as ReturnType<typeof fakeDriver>).name, 'darwin');
  });

  it('on Windows the macOS factory (CoreGraphics) is never called', () => {
    const calls: string[] = [];
    pasteDriverFor(WIN, {
      win32: () => {
        calls.push('win32');
        return fakeDriver('win32');
      },
      darwin: () => {
        calls.push('darwin');
        return fakeDriver('darwin');
      },
    });
    assert.deepEqual(calls, ['win32']);
  });

  it('a factory that throws reaches the caller, which falls back to the copy-only driver (C3)', () => {
    assert.throws(() =>
      pasteDriverFor(WIN, {
        win32: () => {
          throw new Error('koffi');
        },
        darwin: () => fakeDriver('darwin'),
      }),
    );
    assert.equal(COPY_ONLY_DRIVER.targetBlocksPaste(), null);
    assert.equal(COPY_ONLY_DRIVER.sendPasteShortcut(), false);
  });
});

describe('the keyboard hook and the tray / menu bar (FR-PKG-15, FR-MAC-02, FR-MAC-03)', () => {
  it('macOS starts the hook only with Accessibility; Windows always tries', () => {
    assert.equal(shouldStartHook(MAC, false), false);
    assert.equal(shouldStartHook(MAC, true), true);
    assert.equal(shouldStartHook(WIN, false), true);
  });

  it('a hook that is not running comes before the key and the recording, and is never "ready"', () => {
    assert.equal(trayStatus({ hook: 'needs_accessibility', hasApiKey: true, recording: false }), 'no_accessibility');
    assert.equal(trayStatus({ hook: 'unavailable', hasApiKey: false, recording: false }), 'hook_down');
    assert.equal(trayStatus({ hook: 'ok', hasApiKey: false, recording: false }), 'no_key');
    assert.equal(trayStatus({ hook: 'ok', hasApiKey: true, recording: true }), 'recording');
    assert.equal(trayStatus({ hook: 'ok', hasApiKey: true, recording: false }), 'ready');
  });

  it('"Tentar de novo" on both systems when the hook is down; nothing extra when it runs', () => {
    assert.deepEqual(trayActions({ profile: WIN, hook: 'unavailable', retryFailed: false, microphoneBlocked: false }), ['retry_hook']);
    assert.deepEqual(trayActions({ profile: WIN, hook: 'unavailable', retryFailed: true, microphoneBlocked: true }), ['retry_hook']);
    assert.deepEqual(trayActions({ profile: WIN, hook: 'ok', retryFailed: false, microphoneBlocked: false }), []);
    assert.deepEqual(trayActions({ profile: MAC, hook: 'ok', retryFailed: false, microphoneBlocked: false }), []);
  });

  it('macOS without Accessibility: open the settings, try again, and "Reabrir" once a retry failed', () => {
    assert.deepEqual(trayActions({ profile: MAC, hook: 'needs_accessibility', retryFailed: false, microphoneBlocked: false }), [
      'open_accessibility',
      'retry_hook',
    ]);
    assert.deepEqual(trayActions({ profile: MAC, hook: 'needs_accessibility', retryFailed: true, microphoneBlocked: false }), [
      'open_accessibility',
      'retry_hook',
      'relaunch',
    ]);
  });

  it('macOS with the microphone denied offers its settings panel (FR-MAC-05)', () => {
    assert.deepEqual(trayActions({ profile: MAC, hook: 'ok', retryFailed: false, microphoneBlocked: true }), ['open_microphone']);
  });
});

function fakeSystem(state: { trusted?: boolean; mic?: string; askResult?: boolean } = {}) {
  const calls: string[] = [];
  const system: PermissionsSystem = {
    isTrustedAccessibilityClient: (prompt) => {
      calls.push(`trusted:${prompt}`);
      return state.trusted ?? false;
    },
    getMediaAccessStatus: () => state.mic ?? 'not-determined',
    askForMediaAccess: async () => {
      calls.push('ask');
      return state.askResult ?? true;
    },
    openExternal: async (url) => {
      calls.push(`open:${url}`);
    },
  };
  return { system, calls };
}

describe('PermissionsPort (FR-MAC-02, FR-MAC-04, FR-MAC-05)', () => {
  it('Windows: Accessibility does not apply and macOS calls are never made', async () => {
    const { system, calls } = fakeSystem({ mic: 'granted' });
    const port = createPermissions('win32', system);
    assert.equal(port.accessibility(), 'not-applicable');
    port.promptAccessibility();
    assert.equal(await port.requestMicrophone(), true);
    await port.openSettings('accessibility');
    assert.deepEqual(calls, []);
    await port.openSettings('microphone');
    assert.deepEqual(calls, [`open:${SETTINGS_URLS.win32.microphone}`]);
  });

  it('macOS reads Accessibility without the system prompt, and prompts only when asked to', () => {
    const { system, calls } = fakeSystem({ trusted: false });
    const port = createPermissions('darwin', system);
    assert.equal(port.accessibility(), 'denied');
    assert.deepEqual(calls, ['trusted:false']);
    port.promptAccessibility();
    assert.deepEqual(calls, ['trusted:false', 'trusted:true']);
    assert.equal(createPermissions('darwin', fakeSystem({ trusted: true }).system).accessibility(), 'granted');
  });

  it('macOS asks for the microphone only while not-determined', async () => {
    const undecided = fakeSystem({ mic: 'not-determined' });
    assert.equal(await createPermissions('darwin', undecided.system).requestMicrophone(), true);
    assert.deepEqual(undecided.calls, ['ask']);
    for (const mic of ['granted', 'denied', 'restricted']) {
      const decided = fakeSystem({ mic });
      assert.equal(await createPermissions('darwin', decided.system).requestMicrophone(), mic === 'granted', mic);
      assert.deepEqual(decided.calls, [], mic);
    }
  });

  it('an unexpected microphone status is "unknown"', () => {
    assert.equal(createPermissions('darwin', fakeSystem({ mic: 'weird' }).system).microphone(), 'unknown');
  });

  it('macOS opens only the fixed System Settings panels (Security Guide §9)', async () => {
    const { system, calls } = fakeSystem();
    const port = createPermissions('darwin', system);
    await port.openSettings('accessibility');
    await port.openSettings('microphone');
    assert.deepEqual(calls, [
      'open:x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      'open:x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    ]);
  });
});

describe('menu bar template icon (FR-MAC-09)', () => {
  it('is black with alpha only, at 16 and 32 px', () => {
    for (const size of [16, 32]) {
      for (const recording of [false, true]) {
        const bitmap = renderTemplateTrayBitmap(size, recording);
        assert.equal(bitmap.length, size * size * 4);
        let opaque = 0;
        for (let o = 0; o < bitmap.length; o += 4) {
          assert.equal(bitmap[o], 0);
          assert.equal(bitmap[o + 1], 0);
          assert.equal(bitmap[o + 2], 0);
          if ((bitmap[o + 3] ?? 0) > 0) opaque++;
        }
        assert.ok(opaque > size, `${size} px has a glyph`);
      }
    }
  });

  it('"recording" differs by shape: the dot is drawn where the idle icon is empty', () => {
    const size = 32;
    const at = (bitmap: Buffer, x: number, y: number) => bitmap[(Math.floor(y * size) * size + Math.floor(x * size)) * 4 + 3] ?? 0;
    const idle = renderTemplateTrayBitmap(size, false);
    const recording = renderTemplateTrayBitmap(size, true);
    assert.equal(at(idle, 0.8, 0.2), 0);
    assert.ok(at(recording, 0.8, 0.2) > 200);
  });
});
