// Puts text at the cursor of the focused app: clipboard + Ctrl+V, then restores what the user had
// copied (spec ditado-por-voz §4.5, ADR-03). Electron 44 clipboard API: async, W3C ClipboardItem.
import { clipboard, ClipboardItem, type ClipboardBookmark } from 'electron';
import { isForegroundWindowElevated, sendPasteShortcut } from './win32';

export type InsertOutcome = 'inserted' | 'copied';

export interface TextInserterDeps {
  isHotkeyDown(): boolean;
  setInserting(value: boolean): void;
  /** Whether the Touch Speaker process itself runs elevated (then UIPI does not block us). */
  selfElevated: boolean;
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

function targetIsElevated(): boolean {
  try {
    return isForegroundWindowElevated();
  } catch {
    return false;
  }
}

function tryPaste(): boolean {
  try {
    return sendPasteShortcut();
  } catch {
    return false;
  }
}

export class TextInserter {
  constructor(private readonly deps: TextInserterDeps) {}

  async insert(text: string): Promise<InsertOutcome> {
    // The user's physical Ctrl must be up before we press a synthetic one.
    await waitUntil(() => !this.deps.isHotkeyDown(), RELEASE_WAIT_MS);

    if (!this.deps.selfElevated && targetIsElevated()) {
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
      // On failure the dictated text simply stays in the clipboard for a manual Ctrl+V.
      if (!tryPaste()) return 'copied';
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
