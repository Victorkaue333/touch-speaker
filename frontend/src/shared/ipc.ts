// IPC contract between the main process and the pill window (docs/API.md, "Contratos").
// The sandboxed preload cannot require local modules, so src/preload/pill.ts keeps its own copy of
// the channel names. Keep both in sync.

export const Channel = {
  RecorderStart: 'recorder:start',
  RecorderStop: 'recorder:stop',
  RecorderCancel: 'recorder:cancel',
  PillState: 'pill:state',
  RecorderStarted: 'recorder:started',
  RecorderResult: 'recorder:result',
  RecorderError: 'recorder:error',
} as const;

export type SessionMode = 'hold' | 'handsfree';

export type PillStateName = 'listening' | 'transcribing' | 'error' | 'notice' | 'hidden';

export interface PillState {
  state: PillStateName;
  mode: SessionMode;
  message?: string;
  hint?: string;
  /** Recording is close to the time limit. */
  warn?: boolean;
  sounds: boolean;
}

export interface RecorderStartPayload {
  sessionId: string;
  deviceId: string | null;
  maxMs: number;
  sounds: boolean;
}

export interface SessionRef {
  sessionId: string;
}

export interface RecorderStartedPayload {
  sessionId: string;
  startedAt: number;
}

export interface RecorderResultPayload {
  sessionId: string;
  audio: ArrayBuffer;
  mimeType: string;
  durationMs: number;
}

export type RecorderErrorCode = 'mic_denied' | 'mic_unavailable' | 'recorder_failed';

export interface RecorderErrorPayload {
  sessionId: string;
  code: RecorderErrorCode;
  detail?: string;
}
