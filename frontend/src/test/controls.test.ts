import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

// TEST-019 — docs/DESIGN.md §6.5 (Victor, 18/out/2026): the dropdowns of Configurações are customizable selects
// (appearance: base-select, Chromium 152 of Electron 44.9.0) with the Lucide chevron-down and check; the
// checkbox, switch and radio are drawn on the tokens. Contrast stays with tokens.test.ts.

const DIR = path.join(__dirname, '..', '..', 'src', 'renderer', 'main-window');
const css = readFileSync(path.join(DIR, 'main-window.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const html = readFileSync(path.join(DIR, 'index.html'), 'utf8');
const script = readFileSync(path.join(DIR, 'main-window.ts'), 'utf8');

describe('customizable selects (docs/DESIGN.md §6.5)', () => {
  it('select and its picker opt into base-select; the default arrow and checkmark are hidden', () => {
    assert.match(css, /select,\s*::picker\(select\)\s*\{\s*appearance:\s*base-select;/);
    assert.match(css, /select::picker-icon,\s*option::checkmark\s*\{\s*display:\s*none;/);
    assert.match(css, /::picker\(select\)\s*\{[^}]*max-height:\s*280px;[^}]*overflow-y:\s*auto;/);
    assert.match(css, /option\s*\{[^}]*min-height:\s*32px;/);
  });

  it('every select of index.html starts with the trigger: selectedcontent and the Lucide chevron-down', () => {
    const selects = [...html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)].map((m) => m[1] ?? '');
    assert.equal(selects.length, 3);
    for (const inner of selects) {
      assert.match(inner, /^<button type="button" class="select-trigger"><selectedcontent><\/selectedcontent><svg class="select-chevron"/);
      assert.ok(inner.includes('<path d="m6 9 6 6 6-6" />'), 'chevron-down of Lucide 1.52.0');
    }
  });

  it('filling the options keeps the trigger and adds the check to each option', () => {
    assert.match(script, /for \(const old of Array\.from\(select\.querySelectorAll\('option'\)\)\) old\.remove\(\);/);
    assert.match(script, /byId<HTMLTemplateElement>\('icon-option-check'\)/);
    assert.ok(html.includes('<template id="icon-option-check"><svg class="option-check"'));
  });

  it('checkbox, switch and radio are drawn on the tokens, without the native accent colour', () => {
    assert.doesNotMatch(css, /accent-color/);
    assert.match(css, /input\[type='checkbox'\],\s*input\[type='radio'\]\s*\{[^}]*appearance:\s*none;/);
    assert.match(css, /input\[type='checkbox'\]\[role='switch'\]\s*\{/);
  });
});
