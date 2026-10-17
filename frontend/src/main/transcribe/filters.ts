// "Never type garbage" (spec ditado-por-voz §4.4, principle C3). Whisper invents text on silence,
// mostly subtitle credits in pt-BR; these rules decide when a transcription is not real speech.

/** Recordings shorter than this are dropped before upload. */
export const MIN_AUDIO_MS = 500;

const NO_SPEECH_ALL_SEGMENTS = 0.6;
const NO_SPEECH_SUSPICIOUS_MEAN = 0.3;
const SHORT_AUDIO_SECONDS = 3;

const HALLUCINATIONS_EXACT = new Set(['obrigado', 'obrigada', 'tchau', 'inscrevase no canal', 'legendas pela comunidade amaraorg']);
const HALLUCINATION_PREFIXES = ['legendas pela comunidade', 'legendado por'];

export interface VerboseSegment {
  no_speech_prob?: number;
}

export interface VerboseTranscription {
  text?: string;
  duration?: number;
  segments?: VerboseSegment[];
}

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isKnownHallucination(text: string): boolean {
  const normalized = normalizeForMatch(text);
  return HALLUCINATIONS_EXACT.has(normalized) || HALLUCINATION_PREFIXES.some((p) => normalized.startsWith(p));
}

/** True when the transcription should be discarded instead of inserted. */
export function isNoSpeech(t: VerboseTranscription): boolean {
  const text = (t.text ?? '').trim();
  if (text === '') return true;

  const probs = (t.segments ?? []).map((s) => s.no_speech_prob).filter((p): p is number => typeof p === 'number');
  if (probs.length > 0 && probs.every((p) => p >= NO_SPEECH_ALL_SEGMENTS)) return true;

  if (isKnownHallucination(text)) {
    const mean = probs.length > 0 ? probs.reduce((a, b) => a + b, 0) / probs.length : 0;
    const duration = t.duration ?? 0;
    if (duration < SHORT_AUDIO_SECONDS || mean >= NO_SPEECH_SUSPICIOUS_MEAN) return true;
  }
  return false;
}
