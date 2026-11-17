import type { SettingsStore } from "../platform";
import type { NotePath } from "../types";
import { normalizeRoot } from "../vault/path";

export interface RecentVault {
  /** Absolute path of the vault folder, `/` separated. */
  readonly path: string;
  /** The note that was open when the vault was last used. */
  readonly lastOpenedNote: NotePath | null;
  /** Notes opened in the vault, the latest first, for the quick switcher. */
  readonly recentNotes: readonly NotePath[];
}

const MAX_RECENT_VAULTS = 10;
const MAX_RECENT_NOTES = 30;

/**
 * Settings of the app on this device: which vaults were opened and where the
 * user left off in each. They live outside the vaults, so they are not
 * synced with the notes. Settings that travel with a vault go to
 * `.carbon/config.json` instead (ARCHITECTURE.md, section 4.1).
 *
 * Every change is saved before its promise resolves.
 */
export class AppSettings {
  private vaults: readonly RecentVault[];
  private open: string | null;
  /** The last save: saves run one after another, so the newest one wins. */
  private saving: Promise<void> = Promise.resolve();

  private constructor(
    private readonly store: SettingsStore,
    { vaults, open }: Saved,
  ) {
    this.vaults = vaults;
    this.open = open;
  }

  /**
   * Loads the saved settings. Settings that are missing or cannot be
   * understood are replaced by defaults: a damaged settings file must not
   * keep the app from starting.
   */
  static async load(store: SettingsStore): Promise<AppSettings> {
    return new AppSettings(store, parse(await store.read()));
  }

  /**
   * Vaults that were opened on this device, the latest first. The array is
   * replaced, never changed in place, when the list changes.
   */
  get recentVaults(): readonly RecentVault[] {
    return this.vaults;
  }

  /**
   * The vault that was open when the app was last closed, to open again at
   * start; `null` if none was, or the user closed it before leaving.
   */
  get openVault(): string | null {
    return this.open;
  }

  /**
   * Remembers the vault that is open now: call it when a vault is opened,
   * and with `null` when the user closes it. Quitting the app leaves it.
   */
  async setOpenVault(root: string | null): Promise<void> {
    const path = root === null ? null : normalizeRoot(root);
    if (path === this.open) return;
    this.open = path;
    await this.save();
  }

  /**
   * Puts a vault first in the recent list. Call it when a vault is opened.
   * The oldest vaults drop off the end of the list.
   */
  async addRecentVault(root: string): Promise<void> {
    const path = normalizeRoot(root);
    const known = this.vaults.find((v) => v.path === path);
    const rest = this.vaults.filter((v) => v.path !== path);
    const added = known ?? { path, lastOpenedNote: null, recentNotes: [] };
    this.vaults = [added, ...rest].slice(0, MAX_RECENT_VAULTS);
    await this.save();
  }

  /** Takes a vault off the recent list, for example when its folder is gone. */
  async removeRecentVault(root: string): Promise<void> {
    const path = normalizeRoot(root);
    if (!this.vaults.some((v) => v.path === path)) return;
    this.vaults = this.vaults.filter((v) => v.path !== path);
    await this.save();
  }

  /** The note to reopen in a vault, or `null` if there is none. */
  lastOpenedNote(root: string): NotePath | null {
    const path = normalizeRoot(root);
    return this.vaults.find((v) => v.path === path)?.lastOpenedNote ?? null;
  }

  /** The notes opened in a vault, the latest first. */
  recentNotes(root: string): readonly NotePath[] {
    const path = normalizeRoot(root);
    return this.vaults.find((v) => v.path === path)?.recentNotes ?? [];
  }

  /**
   * Remembers the note that is open in a vault; `null` when none is. A
   * note goes first in the recent notes of the vault. The note is
   * remembered as part of the recent list, so a vault that is not on the
   * list is ignored.
   */
  async setLastOpenedNote(root: string, note: NotePath | null): Promise<void> {
    const path = normalizeRoot(root);
    const known = this.vaults.find((v) => v.path === path);
    if (!known || known.lastOpenedNote === note) return;
    const recentNotes =
      note === null
        ? known.recentNotes
        : [note, ...known.recentNotes.filter((n) => n !== note)].slice(
            0,
            MAX_RECENT_NOTES,
          );
    this.update(known, { lastOpenedNote: note, recentNotes });
    await this.save();
  }

  /**
   * Follows a note or folder of a vault that moved from `from` to `to`:
   * the remembered notes at it, or inside it, take the new path.
   */
  async moveNotes(root: string, from: string, to: string): Promise<void> {
    const path = normalizeRoot(root);
    const known = this.vaults.find((v) => v.path === path);
    if (!known) return;
    const move = (note: NotePath) =>
      note === from
        ? to
        : note.startsWith(`${from}/`)
          ? to + note.slice(from.length)
          : note;
    const lastOpenedNote =
      known.lastOpenedNote === null ? null : move(known.lastOpenedNote);
    const recentNotes = known.recentNotes.map(move);
    if (
      lastOpenedNote === known.lastOpenedNote &&
      recentNotes.every((note, i) => note === known.recentNotes[i])
    ) {
      return;
    }
    this.update(known, {
      lastOpenedNote,
      // Moved onto a note that is on the list too: one entry stays.
      recentNotes: [...new Set(recentNotes)],
    });
    await this.save();
  }

  /** Replaces a vault of the list with a changed copy, in its place. */
  private update(vault: RecentVault, change: Partial<RecentVault>) {
    this.vaults = this.vaults.map((v) =>
      v === vault ? { ...v, ...change } : v,
    );
  }

  private save(): Promise<void> {
    const text = `${JSON.stringify(
      { openVault: this.open, recentVaults: this.vaults },
      null,
      2,
    )}\n`;
    // A failed save must not block the ones after it.
    this.saving = this.saving
      .catch(() => {})
      .then(() => this.store.write(text));
    return this.saving;
  }
}

/** What the settings file holds. */
interface Saved {
  vaults: readonly RecentVault[];
  open: string | null;
}

/** Reads what it can from the saved text and skips the rest. */
function parse(text: string | null): Saved {
  if (text === null) return { vaults: [], open: null };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { vaults: [], open: null };
  }
  let open: string | null = null;
  if (isRecord(data) && typeof data.openVault === "string") {
    try {
      open = normalizeRoot(data.openVault);
    } catch {
      // Not a path a vault can have: nothing is opened at start.
    }
  }
  return { vaults: parseVaults(data), open };
}

function parseVaults(data: unknown): RecentVault[] {
  const list: unknown =
    isRecord(data) && Array.isArray(data.recentVaults) ? data.recentVaults : [];
  const vaults: RecentVault[] = [];
  for (const item of list as unknown[]) {
    if (!isRecord(item) || typeof item.path !== "string") continue;
    let path: string;
    try {
      path = normalizeRoot(item.path);
    } catch {
      continue;
    }
    if (vaults.some((v) => v.path === path)) continue;
    const note = item.lastOpenedNote;
    const recent: unknown[] = Array.isArray(item.recentNotes)
      ? item.recentNotes
      : [];
    vaults.push({
      path,
      lastOpenedNote: typeof note === "string" ? note : null,
      recentNotes: [
        ...new Set(recent.filter((n): n is string => typeof n === "string")),
      ].slice(0, MAX_RECENT_NOTES),
    });
  }
  return vaults.slice(0, MAX_RECENT_VAULTS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
