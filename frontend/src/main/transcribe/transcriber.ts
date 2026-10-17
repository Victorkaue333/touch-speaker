import type { ErrorCode } from '../errors';

export type TranscriptionResult =
  | { kind: 'text'; text: string; audioSeconds: number }
  | { kind: 'no_speech' }
  | { kind: 'error'; code: ErrorCode };

/** A speech-to-text provider. Swapping providers means writing another implementation (ADR-04). */
export interface Transcriber {
  hasCredentials(): boolean;
  transcribe(audio: ArrayBuffer, mimeType: string, opts: { language: string }): Promise<TranscriptionResult>;
}
