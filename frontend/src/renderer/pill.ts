// Pill renderer: records the microphone between start and stop, shows the session state.
// Classic script (no imports): loaded by pill.html with `defer`. Texts come from main.

interface Recording {
  sessionId: string;
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  startedAt: number;
  stopRequested: boolean;
  cancelled: boolean;
  meter: { context: AudioContext; analyser: AnalyserNode; frame: number } | null;
}

const api = window.touchSpeaker;
const pillEl = document.getElementById('pill') as HTMLDivElement;
const labelEl = document.getElementById('label') as HTMLSpanElement;
const hintEl = document.getElementById('hint') as HTMLSpanElement;
const timerEl = document.getElementById('timer') as HTMLSpanElement;
const barEls = Array.from(pillEl.querySelectorAll<HTMLSpanElement>('.bars span'));

const BAR_SHAPE = [0.55, 0.8, 1, 0.9, 1, 0.75, 0.5];
const METER_INTERVAL_MS = 33;

let current: Recording | null = null;
let timerHandle: number | null = null;

// ---- Sounds (generated, docs/DESIGN.md §6) ----------------------------------------------------------

function tone(frequencies: number[], noteMs: number): void {
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  let t = ctx.currentTime;
  for (const frequency of frequencies) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + noteMs / 1000);
    osc.start(t);
    osc.stop(t + noteMs / 1000);
    t += noteMs / 1000;
  }
  setTimeout(() => void ctx.close(), frequencies.length * noteMs + 100);
}

const sound = {
  start: () => tone([880], 60),
  stop: () => tone([660], 60),
  error: () => tone([440, 330], 80),
};

// ---- Recording ---------------------------------------------------------------------------------------

function pickMimeType(): string {
  const preferred = 'audio/webm;codecs=opus';
  return MediaRecorder.isTypeSupported(preferred) ? preferred : 'audio/webm';
}

function errorCodeFor(err: unknown): RecorderErrorCode {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'mic_denied';
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') return 'mic_unavailable';
  return 'recorder_failed';
}

function releaseRecording(rec: Recording): void {
  if (rec.meter) {
    clearInterval(rec.meter.frame);
    void rec.meter.context.close();
    rec.meter = null;
  }
  rec.stream?.getTracks().forEach((track) => track.stop());
  rec.stream = null;
  for (const bar of barEls) bar.style.height = '4px';
}

function startMeter(rec: Recording, stream: MediaStream): void {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const frame = window.setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    const level = Math.min(1, Math.sqrt(sum / samples.length) * 6);
    barEls.forEach((bar, i) => {
      bar.style.height = `${Math.round(4 + 16 * level * (BAR_SHAPE[i] ?? 1))}px`;
    });
  }, METER_INTERVAL_MS);
  rec.meter = { context, analyser, frame };
}

function finishRecording(rec: Recording): void {
  const recorder = rec.recorder;
  if (!recorder || recorder.state === 'inactive') return;
  const durationMs = performance.now() - rec.startedAt;
  recorder.onstop = async () => {
    releaseRecording(rec);
    if (rec.cancelled) return;
    const blob = new Blob(rec.chunks, { type: recorder.mimeType });
    const audio = await blob.arrayBuffer();
    api.result({ sessionId: rec.sessionId, audio, mimeType: recorder.mimeType, durationMs });
  };
  recorder.stop();
}

async function beginRecording(payload: RecorderStartPayload): Promise<void> {
  if (current) {
    current.cancelled = true;
    releaseRecording(current);
  }
  const rec: Recording = {
    sessionId: payload.sessionId,
    stream: null,
    recorder: null,
    chunks: [],
    startedAt: 0,
    stopRequested: false,
    cancelled: false,
    meter: null,
  };
  current = rec;
  if (payload.sounds) sound.start();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(payload.deviceId ? { deviceId: { exact: payload.deviceId } } : {}),
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    if (current === rec) current = null;
    api.error({ sessionId: rec.sessionId, code: errorCodeFor(err) });
    return;
  }

  rec.stream = stream;
  if (rec.cancelled) {
    releaseRecording(rec);
    return;
  }

  try {
    const recorder = new MediaRecorder(stream, { mimeType: pickMimeType(), audioBitsPerSecond: 32_000 });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) rec.chunks.push(event.data);
    };
    rec.recorder = recorder;
    recorder.start(1000);
    rec.startedAt = performance.now();
  } catch {
    releaseRecording(rec);
    if (current === rec) current = null;
    api.error({ sessionId: rec.sessionId, code: 'recorder_failed' });
    return;
  }

  startMeter(rec, stream);
  api.started({ sessionId: rec.sessionId, startedAt: Date.now() });
  if (rec.stopRequested) finishRecording(rec);
}

api.onStart((payload) => void beginRecording(payload));

api.onStop(({ sessionId }) => {
  const rec = current;
  if (!rec || rec.sessionId !== sessionId) return;
  if (rec.recorder) finishRecording(rec);
  else rec.stopRequested = true;
});

api.onCancel(({ sessionId }) => {
  const rec = current;
  if (!rec || rec.sessionId !== sessionId) return;
  rec.cancelled = true;
  if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop();
  releaseRecording(rec);
  current = null;
});

// ---- View --------------------------------------------------------------------------------------------

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function setTimerRunning(running: boolean): void {
  if (running && timerHandle === null) {
    const shownFrom = performance.now();
    timerEl.textContent = '0:00';
    timerHandle = window.setInterval(() => {
      const since = current?.startedAt ? current.startedAt : shownFrom;
      timerEl.textContent = formatElapsed(performance.now() - since);
    }, 250);
  } else if (!running && timerHandle !== null) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

let previousState: PillStateName = 'hidden';

api.onState((state) => {
  pillEl.dataset.state = state.state;
  pillEl.dataset.warn = String(Boolean(state.warn));
  labelEl.textContent = state.message ?? '';
  hintEl.textContent = state.hint ?? '';
  setTimerRunning(state.state === 'listening');

  if (state.sounds && state.state !== previousState) {
    if (state.state === 'transcribing' && previousState === 'listening') sound.stop();
    if (state.state === 'error') sound.error();
  }
  previousState = state.state;
});
