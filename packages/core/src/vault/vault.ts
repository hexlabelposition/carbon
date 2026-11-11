import { Emitter } from "../events";
import type { Platform } from "../platform";
import type { NotePath } from "../types";
import { Folders } from "./folders";
import { Notes } from "./notes";
import { normalizeRoot } from "./path";
import { scanTree, type TreeNode } from "./tree";

export interface VaultEvents {
  /** A file was added, changed or removed outside the editor. */
  changed: { kind: "added" | "changed" | "removed"; path: NotePath };
  "index:progress": { done: number; total: number };
  "index:ready": undefined;
  /** An open note changed on disk while it has unsaved edits. */
  conflict: { path: NotePath };
}

/**
 * The single entry point for the UI. Later milestones add `links`,
 * `search`, `tags` and `graph` (ARCHITECTURE.md, section 6).
 */
export class Vault {
  /** Absolute path of the vault folder, `/` separated. */
  readonly root: string;
  readonly notes: Notes;
  readonly folders: Folders;

  private readonly platform: Platform;
  private readonly emitter = new Emitter<VaultEvents>();

  private constructor(root: string, platform: Platform) {
    this.root = root;
    this.platform = platform;
    this.notes = new Notes({ root, fs: platform.fs });
    this.folders = new Folders({ root, fs: platform.fs });
  }

  static async open(root: string, platform: Platform): Promise<Vault> {
    const normalized = normalizeRoot(root);
    const stat = await platform.fs.stat(normalized);
    if (stat.kind !== "dir") {
      throw new Error(`Vault root is not a folder: ${normalized}`);
    }
    return new Vault(normalized, platform);
  }

  /**
   * The folders and files of the vault, without hidden ones. Each call lists
   * the disk again; the tree is cached once the watcher keeps it fresh
   * (C-104).
   */
  tree(): Promise<TreeNode[]> {
    return scanTree(this.platform.fs, this.root);
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
