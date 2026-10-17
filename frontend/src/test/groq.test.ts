import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GroqTranscriber } from '../main/transcribe/groq';

const audio = new Uint8Array([1, 2, 3, 4]).buffer;
const opts = { language: 'pt' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function transcriber(responses: Array<Response | Error>, apiKey: string | undefined = 'gsk_test') {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { t: new GroqTranscriber({ apiKey, model: 'whisper-large-v3-turbo', fetchImpl, retryDelayMs: 1 }), requests };
}

describe('GroqTranscriber (FR-DICT-04)', () => {
  it('returns trimmed text and sends the expected form', async () => {
    const { t, requests } = transcriber([
      json(200, { text: ' Olá mundo. ', duration: 1.5, segments: [{ no_speech_prob: 0.01 }] }),
    ]);
    const result = await t.transcribe(audio, 'audio/webm;codecs=opus', opts);
    assert.deepEqual(result, { kind: 'text', text: 'Olá mundo.', audioSeconds: 1.5 });

    const req = requests[0];
    assert.ok(req);
    assert.equal(req.url, 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.equal((req.init?.headers as Record<string, string>).Authorization, 'Bearer gsk_test');
    const form = req.init?.body as FormData;
    assert.equal(form.get('model'), 'whisper-large-v3-turbo');
    assert.equal(form.get('language'), 'pt');
    assert.equal(form.get('response_format'), 'verbose_json');
    assert.equal(form.get('temperature'), '0');
    assert.equal((form.get('file') as File).name, 'audio.webm');
  });

  it('filters silence', async () => {
    const { t } = transcriber([json(200, { text: 'Obrigado.', duration: 0.9, segments: [{ no_speech_prob: 0.7 }] })]);
    assert.deepEqual(await t.transcribe(audio, 'audio/webm', opts), { kind: 'no_speech' });
  });

  it('without a key it fails fast and never calls the network', async () => {
    const { t, requests } = transcriber([], '');
    assert.equal(t.hasCredentials(), false);
    assert.deepEqual(await t.transcribe(audio, 'audio/webm', opts), { kind: 'error', code: 'no_api_key' });
    assert.equal(requests.length, 0);
  });

  for (const [status, code] of [
    [401, 'invalid_api_key'],
    [413, 'audio_too_large'],
    [429, 'rate_limited'],
  ] as const) {
    it(`maps HTTP ${status} to ${code} without retrying`, async () => {
      const { t, requests } = transcriber([json(status, { error: {} }), json(200, { text: 'x' })]);
      assert.deepEqual(await t.transcribe(audio, 'audio/webm', opts), { kind: 'error', code });
      assert.equal(requests.length, 1);
    });
  }

  it('retries once on 5xx', async () => {
    const { t, requests } = transcriber([json(503, {}), json(200, { text: 'Funcionou.', duration: 2, segments: [] })]);
    assert.deepEqual(await t.transcribe(audio, 'audio/webm', opts), { kind: 'text', text: 'Funcionou.', audioSeconds: 2 });
    assert.equal(requests.length, 2);
  });

  it('gives up after a second 5xx', async () => {
    const { t } = transcriber([json(500, {}), json(502, {})]);
    assert.deepEqual(await t.transcribe(audio, 'audio/webm', opts), { kind: 'error', code: 'provider_error' });
  });

  it('network failure or timeout becomes network_error', async () => {
    const { t } = transcriber([new TypeError('fetch failed')]);
    assert.deepEqual(await t.transcribe(audio, 'audio/webm', opts), { kind: 'error', code: 'network_error' });
  });
});
