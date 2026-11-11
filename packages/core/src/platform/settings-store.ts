/**
 * Where the app settings are kept: one small text document that belongs to
 * the app on this device, not to a vault.
 */
export interface SettingsStore {
  /** The saved text, or `null` if nothing was saved yet. */
  read(): Promise<string | null>;
  /** Replaces the saved text. Atomic, like a note write. */
  write(text: string): Promise<void>;
}
