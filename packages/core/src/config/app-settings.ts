import type { SettingsStore } from "../platform";
import type { NotePath } from "../types";
import { normalizeRoot } from "../vault/path";

export interface RecentVault {
  /** Absolute path of the vault folder, `/` separated. */
  readonly path: string;
  /** The note that was open when the vault was last used. */
  readonly lastOpenedNote: NotePath | null;
}

const MAX_RECENT_VAULTS = 10;

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
  /** The last save: saves run one after another, so the newest one wins. */
  private saving: Promise<void> = Promise.resolve();

  private constructor(
    private readonly store: SettingsStore,
    vaults: readonly RecentVault[],
  ) {
    this.vaults = vaults;
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
   * Puts a vault first in the recent list. Call it when a vault is opened.
   * The oldest vaults drop off the end of the list.
   */
  async addRecentVault(root: string): Promise<void> {
    const path = normalizeRoot(root);
    const known = this.vaults.find((v) => v.path === path);
    const rest = this.vaults.filter((v) => v.path !== path);
    this.vaults = [known ?? { path, lastOpenedNote: null }, ...rest].slice(
      0,
      MAX_RECENT_VAULTS,
    );
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

  /**
   * Remembers the note that is open in a vault; `null` when none is. The
   * note is remembered as part of the recent list, so a vault that is not
   * on the list is ignored.
   */
  async setLastOpenedNote(root: string, note: NotePath | null): Promise<void> {
    const path = normalizeRoot(root);
    const known = this.vaults.find((v) => v.path === path);
    if (!known || known.lastOpenedNote === note) return;
    this.vaults = this.vaults.map((v) =>
      v === known ? { path, lastOpenedNote: note } : v,
    );
    await this.save();
  }

  private save(): Promise<void> {
    const text = `${JSON.stringify({ recentVaults: this.vaults }, null, 2)}\n`;
    // A failed save must not block the ones after it.
    this.saving = this.saving
      .catch(() => {})
      .then(() => this.store.write(text));
    return this.saving;
  }
}

/** Reads what it can from the saved text and skips the rest. */
function parse(text: string | null): RecentVault[] {
  if (text === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
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
    vaults.push({
      path,
      lastOpenedNote: typeof note === "string" ? note : null,
    });
  }
  return vaults.slice(0, MAX_RECENT_VAULTS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
