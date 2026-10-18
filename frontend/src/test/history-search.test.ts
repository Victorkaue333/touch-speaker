import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeForSearch } from '../main/history/search';

// TEST-012 — spec docs/spec/features/historico.md (FR-HIST-10; criterion 11, pure part).

const matches = (text: string, term: string) => normalizeForSearch(text).includes(normalizeForSearch(term));

describe('normalizeForSearch (FR-HIST-10)', () => {
  it('case, accents and punctuation do not matter', () => {
    assert.equal(normalizeForSearch('Não, quer dizer, faz o DEPLOY!'), 'nao quer dizer faz o deploy');
    assert.equal(normalizeForSearch('Ação — coração'), 'acao coracao');
  });

  it('criterion 11: "nao quer" and "DEPLOY" find the entry, "kubernetes" does not', () => {
    const entry = 'Não, quer dizer, faz o deploy';
    assert.ok(matches(entry, 'nao quer'));
    assert.ok(matches(entry, 'DEPLOY'));
    assert.ok(!matches(entry, 'kubernetes'));
  });

  it('punctuation becomes a space, so hyphenated and spaced words meet', () => {
    assert.ok(matches('abrir um pull-request', 'pull request'));
    assert.ok(matches('abrir um pull request', 'pull-request'));
  });

  it('extra spaces collapse; a term of punctuation only is empty', () => {
    assert.equal(normalizeForSearch('  dois   espaços  '), 'dois espacos');
    assert.equal(normalizeForSearch('?!…'), '');
  });

  it('letters and digits of any script stay; only the accents fold', () => {
    assert.equal(normalizeForSearch('Straße'), 'straße');
    assert.equal(normalizeForSearch('Привет, мир!'), 'привет мир');
    assert.equal(normalizeForSearch('Ελληνικά'), 'ελληνικα');
    assert.equal(normalizeForSearch('日本語'), '日本語');
    assert.equal(normalizeForSearch('½ e 3²'), '½ e 3²');
    assert.ok(matches('Reunião em Москва amanhã', 'МОСКВА'));
    assert.ok(!matches('Reunião em Москва amanhã', 'Санкт'));
    assert.ok(matches('a palavra «øre» em norueguês', 'øre'));
  });

  it('a term of emoji or symbols only is empty too (the service answers no entries for it)', () => {
    assert.equal(normalizeForSearch('🙂🎉'), '');
    assert.equal(normalizeForSearch('— · …'), '');
  });
});
