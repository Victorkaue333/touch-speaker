// Puts text at the cursor of the focused app: clipboard + the system's paste shortcut (Ctrl+V on Windows,
// ⌘V on macOS), then restores what the user had copied (spec ditado-por-voz §4.5, ADR-03; spec
// distribuicao-windows-macos FR-MAC-06, ADR-11). Electron 44 clipboard API: async, W3C ClipboardItem.
import { clipboard, ClipboardItem, type ClipboardBookmark } from 'electron';
import type { PasteBlock, PasteDriver } from './paste-driver';

export type InsertOutcome = 'inserted' | 'copied';

export interface TextInserterDeps {
  isHotkeyDown(): boolean;
  setInserting(value: boolean): void;
  /** The paste of this system (platform.ts). */
  driver: PasteDriver;
  /** Told when the paste could not reach the app and the text stayed in the clipboard (log only). */
  onBlocked?(reason: PasteBlock): void;
}

/** Clipboard content kept in memory only, for the few hundred ms of an insertion (Security Guide §6). */
type ClipboardSnapshot = Array<Record<string, Blob | ClipboardBookmark>>;

const RELEASE_WAIT_MS = 2000;
const BEFORE_PASTE_MS = 20;
const AFTER_PASTE_MS = 100;
const RESTORE_AFTER_MS = 250;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitUntil(condition: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) await delay(20);
}

async function snapshotClipboard(): Promise<ClipboardSnapshot> {
  const snapshot: ClipboardSnapshot = [];
  for (const item of await clipboard.read()) {
    const entry: Record<string, Blob | ClipboardBookmark> = {};
    for (const type of item.types) {
      try {
        entry[type] = await item.getType(type);
      } catch {
        // Format the platform cannot hand over; skip it.
      }
    }
    if (Object.keys(entry).length > 0) snapshot.push(entry);
  }
  return snapshot;
}

async function restoreClipboard(snapshot: ClipboardSnapshot): Promise<void> {
  if (snapshot.length === 0) {
    clipboard.clear();
    return;
  }
  await clipboard.write(snapshot.map((entry) => new ClipboardItem(entry)));
}

export class TextInserter {
  constructor(private readonly deps: TextInserterDeps) {}

  async insert(text: string): Promise<InsertOutcome> {
    // The user's physical key (Ctrl, ⌘) must be up before we press a synthetic one.
    await waitUntil(() => !this.deps.isHotkeyDown(), RELEASE_WAIT_MS);

    // BR-009 (elevated window, Windows) and FR-MAC-07 (no Accessibility or Secure Event Input, macOS).
    const blocked = this.deps.driver.targetBlocksPaste();
    if (blocked) {
      this.deps.onBlocked?.(blocked);
      await clipboard.writeText(text);
      return 'copied';
    }

    this.deps.setInserting(true);
    try {
      let snapshot: ClipboardSnapshot | null = null;
      try {
        snapshot = await snapshotClipboard();
      } catch {
        // Could not back up (clipboard busy): still insert, just without restoring.
      }
      await clipboard.writeText(text);
      await delay(BEFORE_PASTE_MS);
      // On failure the dictated text simply stays in the clipboard for a manual paste.
      if (!this.deps.driver.sendPasteShortcut()) return 'copied';
      // Let the synthetic keys go through the keyboard hook before listening again.
      await delay(AFTER_PASTE_MS);
      if (snapshot) {
        const saved = snapshot;
        setTimeout(() => {
          // Only restore if the clipboard still holds our text: the user may have copied something new.
          void clipboard
            .readText()
            .then((current) => (current === text ? restoreClipboard(saved) : undefined))
            .catch(() => undefined);
        }, RESTORE_AFTER_MS - AFTER_PASTE_MS);
      }
      return 'inserted';
    } finally {
      this.deps.setInserting(false);
    }
  }
}
