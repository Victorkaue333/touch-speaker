// Turns raw key events into dictation commands (spec ditado-por-voz §4.1).
// Only three kinds of key are distinguished: the dictation key, Escape, and "something else".
// Which other key was pressed is never known here (docs/Security-Guide.md §7).

export type KeyKind = 'hotkey' | 'escape' | 'other';

/** What the session looks like from the keyboard's point of view. */
export type SessionPhase = 'idle' | 'recording' | 'busy';

export interface HotkeyHost {
  phase(): SessionPhase;
  isInserting(): boolean;
  start(): void;
  stop(): void;
  cancel(reason: 'escape' | 'shortcut'): void;
  switchToHandsFree(): void;
}

export interface HotkeyOptions {
  /** Held at least this long = hold-to-talk; shorter = hands-free toggle. */
  holdThresholdMs: number;
  /** Another key within this window after pressing the dictation key = it was a shortcut, not dictation. */
  shortcutWindowMs: number;
  /**
   * A keydown arriving later than this after the previous one is a new press, even without a keyup
   * in between (keyups can be lost, e.g. while an elevated window has focus). Must exceed the
   * keyboard auto-repeat delay (up to ~1 s in Windows settings).
   */
  repeatGapMs: number;
  now: () => number;
}

export const DEFAULT_HOTKEY_TIMING = { shortcutWindowMs: 1000, repeatGapMs: 1500 } as const;

export class HotkeyController {
  private down = false;
  private downAt = 0;
  private lastDownEventAt = 0;
  private startedByThisPress = false;

  constructor(
    private readonly host: HotkeyHost,
    private readonly opts: HotkeyOptions,
  ) {}

  isHotkeyDown(): boolean {
    return this.down;
  }

  onKeyDown(kind: KeyKind): void {
    if (this.host.isInserting()) return;
    const now = this.opts.now();

    if (kind === 'hotkey') {
      const isAutoRepeat = this.down && now - this.lastDownEventAt < this.opts.repeatGapMs;
      this.lastDownEventAt = now;
      if (isAutoRepeat) return;

      this.down = true;
      this.downAt = now;
      this.startedByThisPress = false;
      const phase = this.host.phase();
      if (phase === 'idle') {
        this.startedByThisPress = true;
        this.host.start();
      } else if (phase === 'recording') {
        this.host.stop();
      }
      return;
    }

    if (kind === 'escape') {
      if (this.host.phase() === 'recording') {
        this.startedByThisPress = false;
        this.host.cancel('escape');
      }
      return;
    }

    if (
      this.down &&
      this.startedByThisPress &&
      this.host.phase() === 'recording' &&
      now - this.downAt < this.opts.shortcutWindowMs
    ) {
      this.startedByThisPress = false;
      this.host.cancel('shortcut');
    }
  }

  onKeyUp(kind: KeyKind): void {
    if (kind !== 'hotkey') return;
    const wasDown = this.down;
    const startedByThisPress = this.startedByThisPress;
    this.down = false;
    this.startedByThisPress = false;
    if (!wasDown || !startedByThisPress || this.host.isInserting()) return;
    if (this.host.phase() !== 'recording') return;

    const heldMs = this.opts.now() - this.downAt;
    if (heldMs >= this.opts.holdThresholdMs) this.host.stop();
    else this.host.switchToHandsFree();
  }
}
