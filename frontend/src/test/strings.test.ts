import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ErrorCode } from '../main/errors';
import { errorMessagesFor, hotkeyNamesFor, mainWindowStrings, stringsFor } from '../main/strings';

// TEST-novo-2 — spec distribuicao-windows-macos §14, crit. 28 (FR-MAC-10): on macOS no text says "Windows" or
// "Ctrl+V"; every error code has its message on both systems.

/** Every string inside a value (functions are called with sample arguments). */
function allTexts(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String((value as (...a: unknown[]) => unknown)('Command direito', 500))];
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(allTexts);
  return [];
}

const SILENT: readonly ErrorCode[] = ['no_speech', 'session_timeout'];

describe('texts per system (FR-MAC-10)', () => {
  it('macOS: no "Windows" and no "Ctrl+V" in the pill, the menu bar, the main window or the errors', () => {
    const texts = [
      ...allTexts(stringsFor('darwin')),
      ...allTexts(mainWindowStrings('darwin')),
      ...allTexts(errorMessagesFor('darwin')),
      ...allTexts(hotkeyNamesFor('darwin')),
    ];
    assert.ok(texts.length > 100);
    for (const text of texts) {
      assert.doesNotMatch(text, /Windows/, text);
      assert.doesNotMatch(text, /Ctrl\+V/, text);
    }
  });

  it('macOS names: ⌘V to paste, "padrão do sistema", the Mac key names, the System Settings path', () => {
    assert.equal(errorMessagesFor('darwin').paste_blocked, 'Texto copiado — cole com ⌘V');
    assert.equal(stringsFor('darwin').trayMicDefault, 'Microfone: padrão do sistema');
    assert.equal(hotkeyNamesFor('darwin').RightMeta, 'Command direito');
    assert.equal(hotkeyNamesFor('darwin').RightAlt, 'Option direita');
    assert.match(errorMessagesFor('darwin').mic_denied, /Ajustes do Sistema/);
  });

  it('Windows keeps the texts of Fase 1', () => {
    assert.equal(errorMessagesFor('win32').paste_blocked, 'Texto copiado — cole com Ctrl+V');
    assert.equal(stringsFor('win32').trayMicDefault, 'Microfone: padrão do Windows');
    assert.equal(hotkeyNamesFor('win32').RightCtrl, 'Ctrl direito');
    assert.equal(errorMessagesFor('win32').mic_denied, 'Sem permissão para usar o microfone');
  });

  it('every error code has a message on both systems (silent codes stay empty)', () => {
    for (const platform of ['win32', 'darwin'] as const) {
      for (const [code, message] of Object.entries(errorMessagesFor(platform)) as [ErrorCode, string][]) {
        if (SILENT.includes(code)) assert.equal(message, '', `${platform} ${code}`);
        else assert.ok(message.length > 0, `${platform} ${code}`);
      }
    }
    assert.deepEqual(Object.keys(errorMessagesFor('darwin')).sort(), Object.keys(errorMessagesFor('win32')).sort());
  });

  it('the hook states of the tray / menu bar have their texts (FR-PKG-15, FR-MAC-02)', () => {
    const t = stringsFor('darwin');
    assert.equal(t.trayNoAccessibility, 'Touch Speaker — falta permissão de Acessibilidade');
    assert.equal(t.trayHookDown, 'Touch Speaker — teclado indisponível');
    assert.equal(t.trayRetry, 'Tentar de novo');
    assert.equal(stringsFor('win32').trayHookDown, t.trayHookDown);
  });
});
