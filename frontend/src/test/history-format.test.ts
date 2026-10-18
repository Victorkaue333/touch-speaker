import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { countWords, HistoryFormatter, previousDay, systemTimeZone, wordsPerMinute } from '../main/history/format';

// TEST-011 — spec docs/spec/features/historico.md (FR-HIST-09, FR-HIST-23, FR-HIST-24; §6 "Fuso horário";
// criterion 10). Clock and time zone are pinned: São Paulo is UTC−3 all year since 2019.

const SP = 'America/Sao_Paulo';
const NOW = Date.parse('2026-10-18T15:00:00.000Z'); // 12:00 in São Paulo

describe('HistoryFormatter — day, time and labels (FR-HIST-09)', () => {
  const f = new HistoryFormatter(SP);

  it('"Hoje", "Ontem", the date without the year in the current year, with the year otherwise (criterion 10)', () => {
    assert.equal(f.dayLabel(Date.parse('2026-10-18T13:00:00.000Z'), NOW), 'Hoje');
    assert.equal(f.dayLabel(Date.parse('2026-10-17T13:00:00.000Z'), NOW), 'Ontem');
    assert.equal(f.dayLabel(Date.parse('2026-10-01T13:00:00.000Z'), NOW), '1 de outubro');
    assert.equal(f.dayLabel(Date.parse('2025-12-30T13:00:00.000Z'), NOW), '30 de dezembro de 2025');
  });

  it('23:30 local of 17/out is "Ontem" although it is already 18/out in UTC (criterion 10)', () => {
    const lateEvening = Date.parse('2026-10-18T02:30:00.000Z');
    assert.equal(f.dayKey(lateEvening), '2026-10-17');
    assert.equal(f.dayLabel(lateEvening, NOW), 'Ontem');
    assert.equal(f.timeLabel(lateEvening), '23:30');
  });

  it('the day turns at local midnight, not at UTC midnight', () => {
    assert.equal(f.dayKey(Date.parse('2026-10-18T02:59:59.999Z')), '2026-10-17');
    assert.equal(f.dayKey(Date.parse('2026-10-18T03:00:00.000Z')), '2026-10-18');
  });

  it('daylight saving in another zone: the local calendar day still decides (New York, 2/nov/2025)', () => {
    const ny = new HistoryFormatter('America/New_York');
    const now = Date.parse('2025-11-03T15:00:00.000Z');
    // 01:30 EDT and 01:30 EST of the change day are both "2/nov", the day before the clock above.
    assert.equal(ny.dayKey(Date.parse('2025-11-02T05:30:00.000Z')), '2025-11-02');
    assert.equal(ny.dayKey(Date.parse('2025-11-02T06:30:00.000Z')), '2025-11-02');
    assert.equal(ny.dayLabel(Date.parse('2025-11-02T06:30:00.000Z'), now), 'Ontem');
  });

  it('previousDay is calendar arithmetic, across months and years', () => {
    assert.equal(previousDay('2026-10-01'), '2026-09-30');
    assert.equal(previousDay('2026-01-01'), '2025-12-31');
    assert.equal(previousDay('2024-03-01'), '2024-02-29');
  });

  it('time in 24 h, duration as m:ss', () => {
    assert.equal(f.timeLabel(Date.parse('2026-10-18T17:32:10.000Z')), '14:32');
    assert.equal(f.timeLabel(Date.parse('2026-10-18T03:05:00.000Z')), '00:05');
    assert.equal(f.durationLabel(12_300), '0:12');
    assert.equal(f.durationLabel(65_000), '1:05');
    assert.equal(f.durationLabel(300_000), '5:00');
    assert.equal(f.durationLabel(0), '0:00');
  });

  it('result notice: nothing for inserted, the two notices of §7 otherwise', () => {
    assert.equal(f.statusLabel('inserted'), null);
    assert.equal(f.statusLabel('copied'), 'Não colado — o texto ficou no clipboard');
    assert.equal(f.statusLabel('failed'), 'A colagem falhou');
  });

  it('retention label for 0, 1, N and null', () => {
    assert.equal(f.retentionLabel(30), 'Guardando os ditados dos últimos 30 dias');
    assert.equal(f.retentionLabel(1), 'Guardando os ditados do último dia');
    assert.equal(f.retentionLabel(null), 'Guardando todos os ditados');
    assert.equal(f.retentionLabel(0), 'O histórico está desligado — nada é guardado');
  });

  it('usage labels: pt-BR thousands, time spoken in s, min, h', () => {
    assert.equal(f.count(1234), '1.234');
    assert.equal(f.count(0), '0');
    assert.equal(f.spokenLabel(45_400), '45 s');
    assert.equal(f.spokenLabel(12 * 60_000 + 20_000), '12 min');
    assert.equal(f.spokenLabel(65 * 60_000), '1 h 05 min');
    assert.equal(f.spokenLabel(0), '0 s');
  });
});

describe('HistoryFormatter — a time zone change with the app open (§6 "Fuso horário")', () => {
  // process.env.TZ moves V8's default zone in this process (node:test runs each file in its own). Deleting it
  // does not move it back, so the original zone is set again at the end.
  const original = systemTimeZone();
  afterEach(() => {
    process.env.TZ = original;
  });

  it('without a pinned zone, syncTimeZone follows the system: "Hoje", "Ontem" and dayKey move with it', () => {
    process.env.TZ = SP;
    const f = new HistoryFormatter();
    const now = Date.parse('2026-10-18T13:00:00.000Z'); // 10:00 of 18/out in São Paulo, 22:00 of 18/out in Tokyo
    const evening = Date.parse('2026-10-17T23:30:00.000Z'); // 20:30 of 17/out in São Paulo, 08:30 of 18/out in Tokyo
    assert.equal(f.timeZone, SP);
    assert.equal(f.dayKey(evening), '2026-10-17');
    assert.equal(f.dayLabel(evening, now), 'Ontem');

    process.env.TZ = 'Asia/Tokyo';
    assert.equal(f.dayKey(evening), '2026-10-17', 'the formatters keep their zone until synced');
    f.syncTimeZone();
    assert.equal(f.timeZone, 'Asia/Tokyo');
    assert.equal(f.dayKey(evening), '2026-10-18');
    assert.equal(f.dayLabel(evening, now), 'Hoje');
    assert.equal(f.timeLabel(evening), '08:30');
  });

  it('a pinned zone never moves', () => {
    const f = new HistoryFormatter(SP);
    process.env.TZ = 'Asia/Tokyo';
    f.syncTimeZone();
    assert.equal(f.timeZone, SP);
    assert.equal(f.dayKey(Date.parse('2026-10-17T23:30:00.000Z')), '2026-10-17');
  });
});

describe('usage math (FR-HIST-23, FR-HIST-24)', () => {
  it('words are whitespace-separated tokens', () => {
    assert.equal(countWords('Vou fazer o deploy amanhã.'), 5);
    assert.equal(countWords('  um\tdois\n\ntrês  '), 3);
    assert.equal(countWords('pull-request, ok?'), 2);
    assert.equal(countWords(''), 0);
  });

  it('words per minute = words / minutes, rounded; null without any recording time', () => {
    assert.equal(wordsPerMinute(150, 60_000), 150);
    assert.equal(wordsPerMinute(100, 40_000), 150);
    assert.equal(wordsPerMinute(7, 3_000), 140);
    assert.equal(wordsPerMinute(10, 0), null);
    assert.equal(wordsPerMinute(0, 0), null);
  });
});
