// Groq Whisper adapter (docs/API.md, "Transcrição (Groq)"). Whole recording in one multipart POST (ADR-04).
import type { ErrorCode } from '../errors';
import { isNoSpeech, type VerboseTranscription } from './filters';
import type { Transcriber, TranscriptionResult } from './transcriber';

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface GroqOptions {
  apiKey: string | undefined;
  model: string;
  timeoutMs?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}

function fileNameFor(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'audio.ogg';
  if (mimeType.includes('wav')) return 'audio.wav';
  return 'audio.webm';
}

function errorForStatus(status: number): ErrorCode {
  if (status === 401 || status === 403) return 'invalid_api_key';
  if (status === 413) return 'audio_too_large';
  if (status === 429) return 'rate_limited';
  return 'provider_error';
}

export class GroqTranscriber implements Transcriber {
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: GroqOptions) {
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.retryDelayMs = opts.retryDelayMs ?? 500;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  hasCredentials(): boolean {
    return Boolean(this.opts.apiKey);
  }

  async transcribe(audio: ArrayBuffer, mimeType: string, { language }: { language: string }): Promise<TranscriptionResult> {
    if (!this.opts.apiKey) return { kind: 'error', code: 'no_api_key' };
    if (audio.byteLength > MAX_UPLOAD_BYTES) return { kind: 'error', code: 'audio_too_large' };

    for (let attempt = 0; attempt < 2; attempt++) {
      const form = new FormData();
      form.append('file', new Blob([audio], { type: mimeType }), fileNameFor(mimeType));
      form.append('model', this.opts.model);
      form.append('language', language);
      form.append('temperature', '0');
      form.append('response_format', 'verbose_json');

      let response: Response;
      try {
        response = await this.fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.opts.apiKey}` },
          body: form,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch {
        return { kind: 'error', code: 'network_error' };
      }

      if (response.ok) {
        let body: VerboseTranscription;
        try {
          body = (await response.json()) as VerboseTranscription;
        } catch {
          return { kind: 'error', code: 'provider_error' };
        }
        if (isNoSpeech(body)) return { kind: 'no_speech' };
        return { kind: 'text', text: (body.text ?? '').trim(), audioSeconds: body.duration ?? 0 };
      }

      if (response.status >= 500 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        continue;
      }
      return { kind: 'error', code: errorForStatus(response.status) };
    }
    return { kind: 'error', code: 'provider_error' };
  }
}
