// Single owner of the dictation session state (spec ditado-por-voz §6):
// idle → recording → transcribing → inserting → idle, with error/notice messages on the pill.
import { randomUUID } from 'node:crypto';
import {
  Channel,
  type PillState,
  type RecorderErrorPayload,
  type RecorderResultPayload,
  type RecorderStartedPayload,
  type SessionMode,
} from '../shared/ipc';
import type { AppConfig } from './config';
import type { ErrorCode } from './errors';
import type { HotkeyHost, SessionPhase } from './hotkey';
import type { InsertOutcome } from './insert/inserter';
import type { Logger } from './logger';
import type { Refiner } from './refine';
import { errorMessage, strings } from './strings';
import { MIN_AUDIO_MS } from './transcribe/filters';
import type { Transcriber } from './transcribe/transcriber';

export interface PillPort {
  setState(state: PillState): void;
  send(channel: string, payload: unknown): void;
}

export interface InserterPort {
  insert(text: string): Promise<InsertOutcome>;
}

export interface SessionDeps {
  config: AppConfig;
  transcriber: Transcriber;
  refiner: Refiner;
  inserter: InserterPort;
  pill: PillPort;
  log: Logger;
  now?: () => number;
  onRecordingChange?: (recording: boolean) => void;
}

type State = 'idle' | 'recording' | 'transcribing' | 'inserting';

/** How long the recorder may take to hand over the audio after `stop`. */
const RESULT_TIMEOUT_MS = 5000;
const MESSAGE_VISIBLE_MS = 4000;
const WARN_BEFORE_END_MS = 30_000;

const shortId = (id: string) => id.slice(0, 8);

export class SessionController implements HotkeyHost {
  private state: State = 'idle';
  private sessionId = '';
  private mode: SessionMode = 'hold';
  private inserting = false;
  private nearLimit = false;
  private startedAt = 0;
  private releasedAt = 0;
  private sessionTimers: NodeJS.Timeout[] = [];
  private resultTimer: NodeJS.Timeout | null = null;
  private messageTimer: NodeJS.Timeout | null = null;
  private readonly now: () => number;

  constructor(private readonly deps: SessionDeps) {
    this.now = deps.now ?? Date.now;
  }

  // ---- HotkeyHost -------------------------------------------------------------------------------

  phase(): SessionPhase {
    if (this.state === 'idle') return 'idle';
    return this.state === 'recording' ? 'recording' : 'busy';
  }

  isInserting(): boolean {
    return this.inserting;
  }

  setInserting(value: boolean): void {
    this.inserting = value;
  }

  start(): void {
    if (this.state !== 'idle') return;
    this.clearMessageTimer();
    if (!this.deps.transcriber.hasCredentials()) {
      this.deps.log.warn('session_rejected', { code: 'no_api_key' });
      this.showMessage('error', 'no_api_key');
      return;
    }

    const { config } = this.deps;
    this.sessionId = randomUUID();
    this.state = 'recording';
    this.mode = 'hold';
    this.nearLimit = false;
    this.startedAt = this.now();
    this.deps.onRecordingChange?.(true);
    this.showListening();
    this.deps.pill.send(Channel.RecorderStart, {
      sessionId: this.sessionId,
      deviceId: config.microphoneDeviceId,
      maxMs: config.maxRecordingMs,
      sounds: config.sounds,
    });

    const max = config.maxRecordingMs;
    this.sessionTimers.push(
      setTimeout(() => {
        this.nearLimit = true;
        this.showListening();
      }, Math.max(0, max - WARN_BEFORE_END_MS)),
      setTimeout(() => {
        this.deps.log.info('session_timeout', { session: shortId(this.sessionId) });
        this.stop();
      }, max),
    );
    this.deps.log.info('session_start', { session: shortId(this.sessionId) });
  }

  switchToHandsFree(): void {
    if (this.state !== 'recording') return;
    this.mode = 'handsfree';
    this.showListening();
  }

  stop(): void {
    if (this.state !== 'recording') return;
    this.clearSessionTimers();
    this.state = 'transcribing';
    this.releasedAt = this.now();
    this.deps.onRecordingChange?.(false);
    this.deps.pill.send(Channel.RecorderStop, { sessionId: this.sessionId });
    this.setPill({ state: 'transcribing', message: strings.transcribing });
    this.resultTimer = setTimeout(() => this.fail('recorder_failed'), RESULT_TIMEOUT_MS);
    this.deps.log.info('session_stop', {
      session: shortId(this.sessionId),
      mode: this.mode,
      recorded_ms: this.releasedAt - this.startedAt,
    });
  }

  cancel(reason: 'escape' | 'shortcut'): void {
    if (this.state !== 'recording') return;
    this.clearSessionTimers();
    this.deps.pill.send(Channel.RecorderCancel, { sessionId: this.sessionId });
    this.state = 'idle';
    this.deps.onRecordingChange?.(false);
    this.hidePill();
    this.deps.log.info('session_cancel', { session: shortId(this.sessionId), reason });
  }

  // ---- Recorder events (from the pill renderer, already validated by main) -----------------------

  onRecorderStarted(payload: RecorderStartedPayload): void {
    if (payload.sessionId !== this.sessionId) return;
    this.deps.log.info('recorder_started', { session: shortId(this.sessionId), latency_ms: this.now() - this.startedAt });
  }

  onRecorderError(payload: RecorderErrorPayload): void {
    if (payload.sessionId !== this.sessionId) return;
    if (this.state !== 'recording' && this.state !== 'transcribing') return;
    this.clearSessionTimers();
    if (this.state === 'recording') this.deps.onRecordingChange?.(false);
    this.fail(payload.code);
  }

  async onRecorderResult(payload: RecorderResultPayload): Promise<void> {
    if (payload.sessionId !== this.sessionId || this.state !== 'transcribing') return;
    this.clearResultTimer();
    const session = shortId(this.sessionId);

    if (payload.durationMs < MIN_AUDIO_MS) {
      this.finishEmpty(session);
      return;
    }

    try {
      const uploadStarted = this.now();
      const result = await this.deps.transcriber.transcribe(payload.audio, payload.mimeType, {
        language: this.deps.config.language,
      });
      const transcribeMs = this.now() - uploadStarted;

      if (result.kind === 'error') {
        this.deps.log.warn('transcribe_failed', { session, code: result.code, transcribe_ms: transcribeMs });
        this.fail(result.code);
        return;
      }
      if (result.kind === 'no_speech') {
        this.finishEmpty(session);
        return;
      }

      const text = await this.deps.refiner.refine(result.text);
      if (!text) {
        this.finishEmpty(session);
        return;
      }

      this.state = 'inserting';
      const outcome = await this.deps.inserter.insert(text);
      this.state = 'idle';
      this.deps.log.info('dictation_done', {
        session,
        mode: this.mode,
        audio_ms: Math.round(payload.durationMs),
        audio_bytes: payload.audio.byteLength,
        transcribe_ms: transcribeMs,
        total_ms: this.now() - this.releasedAt,
        chars: text.length,
        outcome,
      });
      if (outcome === 'copied') this.showMessage('notice', 'paste_blocked');
      else this.hidePill();
    } catch (err) {
      this.deps.log.error('session_exception', { session, name: err instanceof Error ? err.name : 'unknown' });
      this.fail('provider_error');
    }
  }

  /** Cancels whatever is running; used when the app quits. */
  shutdown(): void {
    if (this.state === 'recording') this.cancel('escape');
    this.clearSessionTimers();
    this.clearResultTimer();
    this.clearMessageTimer();
  }

  // ---- Helpers ----------------------------------------------------------------------------------

  private finishEmpty(session: string): void {
    this.state = 'idle';
    this.hidePill();
    this.deps.log.info('session_empty', { session, code: 'no_speech' });
  }

  private fail(code: ErrorCode): void {
    this.clearResultTimer();
    this.state = 'idle';
    this.deps.log.warn('session_error', { session: shortId(this.sessionId), code });
    this.showMessage('error', code);
  }

  private showListening(): void {
    const hint = this.nearLimit
      ? strings.endsIn(WARN_BEFORE_END_MS / 1000)
      : this.mode === 'handsfree'
        ? strings.handsFreeHint
        : undefined;
    this.setPill({ state: 'listening', message: strings.listening, hint, warn: this.nearLimit });
  }

  private showMessage(kind: 'error' | 'notice', code: ErrorCode): void {
    this.setPill({ state: kind, message: errorMessage(code) });
    this.clearMessageTimer();
    this.messageTimer = setTimeout(() => {
      this.messageTimer = null;
      if (this.state === 'idle') this.hidePill();
    }, MESSAGE_VISIBLE_MS);
  }

  private hidePill(): void {
    this.setPill({ state: 'hidden' });
  }

  private setPill(partial: Omit<PillState, 'mode' | 'sounds'>): void {
    this.deps.pill.setState({ ...partial, mode: this.mode, sounds: this.deps.config.sounds });
  }

  private clearSessionTimers(): void {
    for (const t of this.sessionTimers) clearTimeout(t);
    this.sessionTimers = [];
  }

  private clearResultTimer(): void {
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.resultTimer = null;
  }

  private clearMessageTimer(): void {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = null;
  }
}
