import { Emitter } from "../events";
import type { Platform } from "../platform";
import type { NotePath } from "../types";
import { Folders } from "./folders";
import { Notes } from "./notes";
import { OwnChanges } from "./own-changes";
import { checkVaultName, normalizeRoot } from "./path";
import { scanTree, type TreeNode } from "./tree";
import { VaultWatch, type VaultChange } from "./watch";

export interface VaultEvents {
  /**
   * A note, another file or a folder was added, changed or removed by
   * something other than this vault object: another program, a sync tool.
   */
  changed: VaultChange;
  "index:progress": { done: number; total: number };
  "index:ready": undefined;
  /** An open note changed on disk while it has unsaved edits. */
  conflict: { path: NotePath };
}

export interface VaultOptions {
  /**
   * How long the vault must be quiet before outside changes are reported,
   * in milliseconds. Editors and sync tools touch a file several times per
   * save; the delay turns each burst into one event.
   */
  changeDelayMs?: number;
}

const DEFAULT_CHANGE_DELAY_MS = 100;

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
  private readonly watch: VaultWatch;
  private isWatching = false;
  private cachedTree: Promise<TreeNode[]> | null = null;

  private constructor(root: string, platform: Platform, delayMs: number) {
    const { fs, watcher, trash } = platform;
    const forgetTree = () => {
      this.cachedTree = null;
    };
    const own = new OwnChanges(fs, forgetTree);

    this.root = root;
    this.platform = platform;
    this.notes = new Notes({ root, fs, trash, own });
    this.folders = new Folders({ root, fs, trash, own });
    this.watch = new VaultWatch({
      root,
      fs,
      watcher,
      own,
      delayMs,
      onActivity: forgetTree,
      onChange: (change) => this.emitter.emit("changed", change),
    });
  }

  /**
   * Opens a folder as a vault and starts watching it. If watching cannot
   * start, the vault still opens: see `watching`.
   */
  static async open(
    root: string,
    platform: Platform,
    options: VaultOptions = {},
  ): Promise<Vault> {
    const normalized = normalizeRoot(root);
    const stat = await platform.fs.stat(normalized);
    if (stat.kind !== "dir") {
      throw new Error(`Vault root is not a folder: ${normalized}`);
    }
    const vault = new Vault(
      normalized,
      platform,
      options.changeDelayMs ?? DEFAULT_CHANGE_DELAY_MS,
    );
    try {
      await vault.watch.start();
      vault.isWatching = true;
    } catch {
      // Without a watcher the vault works, it only cannot see outside
      // changes. The UI can tell the user through `watching`.
    }
    return vault;
  }

  /**
   * Creates the folder `name` inside the folder `parent` and opens it as a
   * new, empty vault. Rejects if the name is not a valid folder name (see
   * `checkVaultName`) or something with that name already exists.
   */
  static async create(
    parent: string,
    name: string,
    platform: Platform,
    options: VaultOptions = {},
  ): Promise<Vault> {
    checkVaultName(name);
    // Not `normalizeRoot(parent)`: a drive root such as "/" or "C:/" is a
    // fine place for a vault folder, though it is not a vault itself.
    const folder = parent.replaceAll("\\", "/").replace(/\/+$/, "");
    const root = normalizeRoot(`${folder}/${name}`);
    if (await platform.fs.exists(root)) {
      throw new Error(`Already exists: ${root}`);
    }
    await platform.fs.mkdir(root);
    return Vault.open(root, platform, options);
  }

  /**
   * Whether outside changes are noticed. False if the platform could not
   * watch the folder, and after `close()`.
   */
  get watching(): boolean {
    return this.isWatching;
  }

  /**
   * The folders and files of the vault, without hidden ones. Treat the
   * result as read-only: while the vault is watched, the tree is listed
   * once and reused until something changes.
   */
  tree(): Promise<TreeNode[]> {
    const { fs } = this.platform;
    // Without a watcher nothing would say when the cache is stale.
    if (!this.isWatching) return scanTree(fs, this.root);
    this.cachedTree ??= scanTree(fs, this.root);
    return this.cachedTree;
  }

  /** Subscribes to a vault event. Returns a function that unsubscribes. */
  on<K extends keyof VaultEvents>(
    event: K,
    listener: (payload: VaultEvents[K]) => void,
  ): () => void {
    return this.emitter.on(event, listener);
  }

  close(): void {
    this.watch.stop();
    this.isWatching = false;
    this.cachedTree = null;
    this.emitter.clear();
  }
}
