import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isNoSpeech, normalizeForMatch } from '../main/transcribe/filters';

describe('normalizeForMatch', () => {
  it('drops accents, punctuation and case', () => {
    assert.equal(normalizeForMatch('  Inscreva-se no Canal!  '), 'inscrevase no canal');
    assert.equal(normalizeForMatch('Legendas pela comunidade Amara.org'), 'legendas pela comunidade amaraorg');
  });
});

describe('isNoSpeech (FR-DICT-08)', () => {
  it('real speech passes', () => {
    assert.equal(
      isNoSpeech({ text: ' Fazer o deploy no Docker.', duration: 2.8, segments: [{ no_speech_prob: 0.01 }] }),
      false,
    );
  });

  it('empty text is discarded', () => {
    assert.equal(isNoSpeech({ text: '   ', duration: 1, segments: [] }), true);
  });

  it('every segment flagged as silence is discarded', () => {
    assert.equal(
      isNoSpeech({ text: 'Tchau tchau.', duration: 4, segments: [{ no_speech_prob: 0.8 }, { no_speech_prob: 0.65 }] }),
      true,
    );
  });

  it('known hallucination on short audio is discarded', () => {
    assert.equal(
      isNoSpeech({ text: 'Legendas pela comunidade Amara.org', duration: 1.2, segments: [{ no_speech_prob: 0.1 }] }),
      true,
    );
  });

  it('"Obrigado." spoken clearly in longer audio is kept', () => {
    assert.equal(isNoSpeech({ text: 'Obrigado.', duration: 4, segments: [{ no_speech_prob: 0.02 }] }), false);
  });

  it('"Obrigado." with suspicious silence probability is discarded', () => {
    assert.equal(isNoSpeech({ text: 'Obrigado.', duration: 5, segments: [{ no_speech_prob: 0.45 }] }), true);
  });

  it('missing segments do not crash', () => {
    assert.equal(isNoSpeech({ text: 'Olá, tudo bem?' }), false);
  });
});
