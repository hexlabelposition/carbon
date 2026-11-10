import { Emitter } from "../events";
import type { Platform } from "../platform";
import type { NotePath } from "../types";
import { normalizeRoot, resolveInVault } from "./path";

export interface VaultEvents {
  /** A file was added, changed or removed outside the editor. */
  changed: { kind: "added" | "changed" | "removed"; path: NotePath };
  "index:progress": { done: number; total: number };
  "index:ready": undefined;
  /** An open note changed on disk while it has unsaved edits. */
  conflict: { path: NotePath };
}

/**
 * The single entry point for the UI. Later milestones add `tree()`,
 * `links`, `search`, `tags` and `graph` (ARCHITECTURE.md, section 6).
 */
export class Vault {
  /** Absolute path of the vault folder, `/` separated. */
  readonly root: string;
  readonly notes: Notes;

  private readonly emitter = new Emitter<VaultEvents>();

  private constructor(root: string, platform: Platform) {
    this.root = root;
    this.notes = new Notes(root, platform);
  }

  static async open(root: string, platform: Platform): Promise<Vault> {
    const normalized = normalizeRoot(root);
    const stat = await platform.fs.stat(normalized);
    if (stat.kind !== "dir") {
      throw new Error(`Vault root is not a folder: ${normalized}`);
    }
    return new Vault(normalized, platform);
  }

  /** Subscribes to a vault event. Returns a function that unsubscribes. */
  on<K extends keyof VaultEvents>(
    event: K,
    listener: (payload: VaultEvents[K]) => void,
  ): () => void {
    return this.emitter.on(event, listener);
  }

  close(): void {
    this.emitter.clear();
  }
}

class Notes {
  constructor(
    private readonly root: string,
    private readonly platform: Platform,
  ) {}

  /** Reads the text of a note. `path` is relative to the vault root. */
  read(path: NotePath): Promise<string> {
    return this.platform.fs.readText(resolveInVault(this.root, path));
  }
}

export type { Notes };
