// How the synthetic paste reaches the focused app on each system (spec distribuicao-windows-macos §8, ADR-11):
// Ctrl+V by SendInput on Windows (win32-driver.ts, ADR-03), ⌘V by CGEventPost on macOS (darwin.ts). The
// TextInserter only knows this interface; the rules around it (wait for the key, back up and restore the
// clipboard, fall back to "copied") are the same on both (BR-008, BR-009, BR-010).

/** Why a synthetic paste would not reach the focused app right now. */
export type PasteBlock =
  /** Windows: the focused window is elevated and UIPI drops our input (BR-009). */
  | 'elevated_target'
  /** macOS: the app is not (or no longer) a trusted Accessibility client (FR-MAC-07). */
  | 'no_accessibility'
  /** macOS: Secure Event Input is on (password field, Terminal's secure keyboard entry — FR-MAC-07). */
  | 'secure_input';

export interface PasteDriver {
  /** null when the paste can go through; the reason otherwise, and the text stays in the clipboard. */
  targetBlocksPaste(): PasteBlock | null;
  /** Sends the system's paste shortcut. false when the system did not take it. Never throws. */
  sendPasteShortcut(): boolean;
}
