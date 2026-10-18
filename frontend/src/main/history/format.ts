// Labels of the history (spec historico FR-HIST-09, §6 "Fuso horário"): the local day, "Hoje" / "Ontem" / the
// date in full in pt-BR (with the year only when it is not the current one), the time, the duration, the notice
// of the insertion result, the retention and the usage totals of Início. Intl in pt-BR, texts from strings.ts,
// clock injected. Time zone: a pinned one (tests) never changes; without it, the system's — Intl fixes the zone
// of a formatter when it is built, so syncTimeZone re-reads the system's and rebuilds the date formatters when it
// changed (a time zone change with the app open). One check costs about as much as building a formatter
// (~0.1 ms), so the service calls it once per answer, not once per label. Pure apart from that read (TEST-011).
import type { HistoryEntryStatus, RetentionDays } from '../../shared/ipc';
import { historyStrings } from '../strings';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The date formatters, all built for one time zone. */
interface ZonedFormats {
  zone: string;
  dayParts: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  dateSameYear: Intl.DateTimeFormat;
  dateOtherYear: Intl.DateTimeFormat;
}

function zonedFormats(timeZone: string): ZonedFormats {
  return {
    zone: timeZone,
    dayParts: new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    dateSameYear: new Intl.DateTimeFormat('pt-BR', { timeZone, day: 'numeric', month: 'long' }),
    dateOtherYear: new Intl.DateTimeFormat('pt-BR', { timeZone, day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

/** The IANA zone the system is in now. */
export function systemTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export class HistoryFormatter {
  private zoned: ZonedFormats;
  private readonly number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

  /** `pinnedZone` fixes an IANA zone; undefined = the system's, followed through syncTimeZone. */
  constructor(private readonly pinnedZone?: string) {
    this.zoned = zonedFormats(pinnedZone ?? systemTimeZone());
  }

  /** The zone of the labels. */
  get timeZone(): string {
    return this.zoned.zone;
  }

  /** Without a pinned zone: rebuilds the date formatters if the system's zone changed since they were built. */
  syncTimeZone(): void {
    if (this.pinnedZone !== undefined) return;
    const zone = systemTimeZone();
    if (zone !== this.zoned.zone) this.zoned = zonedFormats(zone);
  }

  /** YYYY-MM-DD of the instant in the time zone. */
  dayKey(ms: number): string {
    let year = '';
    let month = '';
    let day = '';
    for (const part of this.zoned.dayParts.formatToParts(ms)) {
      if (part.type === 'year') year = part.value;
      else if (part.type === 'month') month = part.value;
      else if (part.type === 'day') day = part.value;
    }
    return `${year.padStart(4, '0')}-${month}-${day}`;
  }

  /** "Hoje", "Ontem", "1 de outubro" or "30 de dezembro de 2025", against the clock `nowMs`. */
  dayLabel(ms: number, nowMs: number): string {
    const key = this.dayKey(ms);
    const today = this.dayKey(nowMs);
    if (key === today) return historyStrings.today;
    if (key === previousDay(today)) return historyStrings.yesterday;
    return key.slice(0, 4) === today.slice(0, 4) ? this.zoned.dateSameYear.format(ms) : this.zoned.dateOtherYear.format(ms);
  }

  /** "14:32" */
  timeLabel(ms: number): string {
    return this.zoned.time.format(ms);
  }

  /** Recording length as m:ss ("0:12"); a recording is at most 5 min (BR-011). */
  durationLabel(audioMs: number): string {
    const total = Math.max(0, Math.round(audioMs / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  statusLabel(status: HistoryEntryStatus): string | null {
    if (status === 'copied') return historyStrings.statusCopied;
    if (status === 'failed') return historyStrings.statusFailed;
    return null;
  }

  retentionLabel(days: RetentionDays): string {
    if (days === null) return historyStrings.retentionForever;
    if (days === 0) return historyStrings.retentionOff;
    return historyStrings.retentionDays(days);
  }

  /** "1.234" */
  count(n: number): string {
    return this.number.format(n);
  }

  /** Time spoken: "45 s", "12 min", "1 h 05 min". */
  spokenLabel(ms: number): string {
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 60) return historyStrings.seconds(seconds);
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return historyStrings.minutes(minutes);
    return historyStrings.hoursMinutes(Math.floor(minutes / 60), minutes % 60);
  }
}

/** The calendar day before YYYY-MM-DD, by calendar arithmetic (no time zone, no daylight saving involved). */
export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - DAY_MS).toISOString().slice(0, 10);
}

/** Whitespace-separated tokens (FR-HIST-23). */
export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

/** Total words over total minutes of the entries that have a recording length; null without any (FR-HIST-24). */
export function wordsPerMinute(words: number, audioMs: number): number | null {
  if (audioMs <= 0) return null;
  return Math.round(words / (audioMs / 60_000));
}
