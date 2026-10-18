import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { DEFAULT_CONFIG, type AppConfig } from '../main/config';
import type { HistoryEntryInput, HistoryPort } from '../main/history/service';
import { HistoryService } from '../main/history/service';
import type { InsertOutcome } from '../main/insert/inserter';
import { SessionController } from '../main/session';
import type { TranscriptionResult } from '../main/transcribe/transcriber';
import { Channel, type PillState, type RecorderStartPayload } from '../shared/ipc';
import { failingSaves, memoryStore, RecordingLog } from './history-fakes';

// TEST-014 — spec docs/spec/features/historico.md (FR-HIST-01…04, 06, 17; criteria 3, 4, 5, 7, 17, 23):
// SessionController with fake ports. The text is distinctive so the log check (C1) cannot pass by accident.

const TEXT = 'zebracapivara diz que o deploy fica para amanhã';
const NOW = Date.parse('2026-10-18T12:00:00.000Z');

interface Rig {
  session: SessionController;
  log: RecordingLog;
  order: string[];
  saved: HistoryEntryInput[];
  pillStates: PillState[];
  sessionId: () => string;
}

interface RigOptions {
  transcribe?: () => Promise<TranscriptionResult>;
  refine?: (text: string) => Promise<string>;
  insert?: () => Promise<InsertOutcome>;
  hasKey?: boolean;
  history?: HistoryPort | null;
  config?: AppConfig;
}

let rigs: Rig[] = [];
afterEach(() => {
  for (const r of rigs) r.session.shutdown();
  rigs = [];
});

function rig(opts: RigOptions = {}): Rig {
  const order: string[] = [];
  const saved: HistoryEntryInput[] = [];
  const pillStates: PillState[] = [];
  let started: RecorderStartPayload | null = null;
  const log = new RecordingLog((line) => order.push(`log:${line.event}`));
  const fakeHistory: HistoryPort = {
    save: (entry) => {
      order.push('save');
      saved.push(entry);
    },
  };
  const session = new SessionController({
    config: opts.config ?? structuredClone(DEFAULT_CONFIG),
    transcriber: {
      hasCredentials: () => opts.hasKey ?? true,
      transcribe: opts.transcribe ?? (async () => ({ kind: 'text', text: TEXT, audioSeconds: 4 })),
    },
    refiner: { refine: opts.refine ?? (async (t: string) => t) },
    inserter: {
      insert: async (text: string) => {
        order.push('insert');
        assert.equal(text, TEXT);
        return opts.insert ? opts.insert() : 'inserted';
      },
    },
    pill: {
      setState: (s) => pillStates.push(s),
      send: (channel, payload) => {
        if (channel === Channel.RecorderStart) started = payload as RecorderStartPayload;
      },
    },
    log,
    now: () => NOW,
    history: opts.history === null ? undefined : (opts.history ?? fakeHistory),
  });
  const r: Rig = { session, log, order, saved, pillStates, sessionId: () => started?.sessionId ?? '' };
  rigs.push(r);
  return r;
}

/** Records for `durationMs` and delivers the audio, like the pill does. */
async function dictate(r: Rig, durationMs = 4200): Promise<void> {
  r.session.start();
  r.session.stop();
  await r.session.onRecorderResult({ sessionId: r.sessionId(), audio: new ArrayBuffer(64), mimeType: 'audio/webm', durationMs });
}

const assertNoTextInLog = (r: Rig) => assert.ok(!r.log.dump().includes('zebracapivara'), 'dictated text reached the log');

describe('SessionController → HistoryPort (spec historico)', () => {
  it('insert → dictation_done → save, with the entry of §9 (FR-HIST-01, FR-HIST-04; criterion 4)', async () => {
    const r = rig();
    await dictate(r);
    const tail = r.order.slice(r.order.indexOf('insert'));
    assert.deepEqual(tail.slice(0, 3), ['insert', 'log:dictation_done', 'save']);
    assert.deepEqual(r.saved, [{ id: r.sessionId(), createdAt: '2026-10-18T12:00:00.000Z', text: TEXT, audioMs: 4200, status: 'inserted' }]);
    assert.deepEqual(r.pillStates.at(-1)?.state, 'hidden');
    assertNoTextInLog(r);
  });

  it('a blocked paste is kept as copied (FR-HIST-01; criterion 2, logic)', async () => {
    const r = rig({ insert: async () => 'copied' });
    await dictate(r);
    assert.equal(r.saved[0]?.status, 'copied');
    assert.equal(r.pillStates.at(-1)?.state, 'notice');
  });

  it('an insertion that throws after the text exists is kept as failed, after session_exception (FR-HIST-02; criterion 3)', async () => {
    const r = rig({
      insert: async () => {
        throw new Error('SendInput refused');
      },
    });
    await dictate(r);
    assert.equal(r.saved.length, 1);
    assert.equal(r.saved[0]?.status, 'failed');
    assert.equal(r.saved[0]?.text, TEXT);
    assert.ok(r.order.indexOf('log:session_exception') < r.order.indexOf('save'));
    assert.equal(r.pillStates.at(-1)?.state, 'error');
    assertNoTextInLog(r);
  });

  it('an exception before the text (transcriber or Refiner) records nothing (FR-HIST-02; criterion 3)', async () => {
    const throwing = rig({
      transcribe: async () => {
        throw new Error('boom');
      },
    });
    await dictate(throwing);
    const refinerThrows = rig({
      refine: async () => {
        throw new Error('boom');
      },
    });
    await dictate(refinerThrows);
    assert.deepEqual([...throwing.saved, ...refinerThrows.saved], []);
  });

  it('no exit without text touches the history (FR-HIST-03; criterion 5)', async () => {
    const cases: [string, Rig, (r: Rig) => Promise<void>][] = [
      ['Esc', rig(), async (r) => (r.session.start(), r.session.cancel('escape'))],
      ['shortcut', rig(), async (r) => (r.session.start(), r.session.cancel('shortcut'))],
      ['short recording', rig(), (r) => dictate(r, 300)],
      ['no_speech', rig({ transcribe: async () => ({ kind: 'no_speech' }) }), (r) => dictate(r)],
      ['empty after the Refiner', rig({ refine: async () => '' }), (r) => dictate(r)],
      ['Groq error', rig({ transcribe: async () => ({ kind: 'error', code: 'rate_limited' }) }), (r) => dictate(r)],
      ['no key', rig({ hasKey: false }), async (r) => r.session.start()],
      [
        'recorder:error',
        rig(),
        async (r) => {
          r.session.start();
          r.session.onRecorderError({ sessionId: r.sessionId(), code: 'mic_unavailable' });
        },
      ],
    ];
    for (const [name, r, run] of cases) {
      await run(r);
      assert.deepEqual(r.saved, [], name);
      assert.ok(!r.order.includes('insert'), name);
    }
  });

  it('without a HistoryPort nothing changes', async () => {
    const r = rig({ history: null });
    await dictate(r);
    assert.ok(r.log.events().includes('dictation_done'));
    assert.equal(r.pillStates.at(-1)?.state, 'hidden');
  });
});

describe('SessionController with the real HistoryService (FR-HIST-06, FR-HIST-17)', () => {
  const service = (retentionDays: number | null, store = memoryStore(), log = new RecordingLog()) =>
    new HistoryService({
      store,
      retentionDays,
      writer: { update: async () => ({ ok: true }) },
      clipboard: { writeText: () => {} },
      notify: () => {},
      log,
      now: () => NOW,
      timeZone: 'America/Sao_Paulo',
    });

  it('"Nunca guardar" (0): the dictation is pasted and no entry is written (criterion 7)', async () => {
    const store = memoryStore();
    const history = service(0, store);
    const r = rig({ history });
    await dictate(r);
    assert.ok(r.order.includes('insert'));
    assert.equal(store.count(), 0);
    assert.equal(history.list({ query: '', after: null, limit: 50 }).status, 'disabled');
  });

  it('a store that fails to write: same dictation result, history_write_failed, unsavedCount 1 (criterion 17)', async () => {
    const log = new RecordingLog();
    const history = service(30, failingSaves(memoryStore()), log);
    const r = rig({ history });
    await dictate(r);
    assert.ok(r.log.events().includes('dictation_done'));
    assert.equal(r.pillStates.at(-1)?.state, 'hidden');
    const failure = log.lines.find((l) => l.event === 'history_write_failed');
    assert.deepEqual(failure?.fields, { session: r.sessionId().slice(0, 8), name: 'SQLITE_13' });
    const list = history.list({ query: '', after: null, limit: 50 });
    assert.equal(list.unsavedCount, 1);
    assert.equal(list.unsavedLabel, '1 ditado não foi guardado no histórico desde que o app abriu');
    assert.ok(!log.dump().includes('zebracapivara'));
  });

  it('the saved entry is listed with its labels, and neither log sees the text (criteria 1, 23)', async () => {
    const log = new RecordingLog();
    const history = service(30, memoryStore(), log);
    const r = rig({ history });
    await dictate(r);
    assert.deepEqual(log.events(), ['history_saved']);
    const [entry] = history.list({ query: '', after: null, limit: 50 }).entries;
    assert.equal(entry?.text, TEXT);
    assert.equal(entry?.dayLabel, 'Hoje');
    assert.equal(entry?.timeLabel, '09:00');
    assert.equal(entry?.durationLabel, '0:04');
    assert.equal(entry?.statusLabel, null);
    assert.ok(!log.dump().includes('zebracapivara') && !r.log.dump().includes('zebracapivara'));
  });
});
