// Shape of window.touchSpeaker (exposed by src/preload/pill.ts). Mirrors src/shared/ipc.ts.

type SessionMode = 'hold' | 'handsfree';
type PillStateName = 'listening' | 'transcribing' | 'error' | 'notice' | 'hidden';
type RecorderErrorCode = 'mic_denied' | 'mic_unavailable' | 'recorder_failed';

interface PillState {
  state: PillStateName;
  mode: SessionMode;
  message?: string;
  hint?: string;
  warn?: boolean;
  sounds: boolean;
}

interface RecorderStartPayload {
  sessionId: string;
  deviceId: string | null;
  maxMs: number;
  sounds: boolean;
}

interface TouchSpeakerPillApi {
  onStart(callback: (payload: RecorderStartPayload) => void): void;
  onStop(callback: (payload: { sessionId: string }) => void): void;
  onCancel(callback: (payload: { sessionId: string }) => void): void;
  onState(callback: (payload: PillState) => void): void;
  started(payload: { sessionId: string; startedAt: number }): void;
  result(payload: { sessionId: string; audio: ArrayBuffer; mimeType: string; durationMs: number }): void;
  error(payload: { sessionId: string; code: RecorderErrorCode; detail?: string }): void;
}

interface Window {
  touchSpeaker: TouchSpeakerPillApi;
}
