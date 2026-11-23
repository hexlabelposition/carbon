import { Emitter } from "../events";
import { Indexer } from "../index/indexer";
import type { ScanResult, ScanWaits } from "../index/scan";
import { IndexStore } from "../index/index-store";
import { Graph } from "../links/graph";
import { Links } from "../links/links";
import { LinkRewriter } from "../links/rename";
import { inlineParser } from "../parser/parse-files";
import { Search } from "../search/search";
import { Tags } from "../tags/tags";
import { Attachments } from "./attachments";
import type { Platform } from "../platform";
import type { NotePath } from "../types";
import { Folders } from "./folders";
import { Notes } from "./notes";
import { OwnChanges } from "./own-changes";
import {
  checkVaultName,
  DRAFTS_FOLDER,
  isVaultPath,
  normalizeRoot,
} from "./path";
import { Bookmarks } from "./bookmarks";
import { VaultTrash } from "./trash";
import { scanTree, type TreeNode } from "./tree";
import { VaultWatch, type VaultChange } from "./watch";
import { VaultError } from "../errors";

/** Where the index of an open vault is; see `Vault.indexStatus`. */
export type IndexStatus =
  /**
   * The startup scan is running: `done` of `total` new and changed notes
   * are indexed. `total` is `null` until the scan has counted them.
   */
  | { state: "scanning"; done: number; total: number | null }
  /**
   * The startup scan is done; later changes are indexed as they come. It
   * found `notes` notes and indexed the `indexed` new and changed ones,
   * `ms` milliseconds after the index began to open, and was done at
   * `doneAt` (`Date.now()`): for measuring the budgets (C-602).
   */
  | {
      state: "ready";
      notes: number;
      indexed: number;
      ms: number;
      doneAt: number;
      /** Where the scan waited (`ScanWaits`). */
      waits: ScanWaits;
    }
  /** The index could not be opened or scanned; the notes work without it. */
  | { state: "failed"; error: unknown };

export interface VaultEvents {
  /**
   * A note, another file or a folder was added, changed or removed by
   * something other than this vault object: another program, a sync tool.
   */
  changed: VaultChange;
  /**
   * The startup scan indexed another batch: `done` of `total` new and
   * changed notes. The first one, with `done` 0, comes once they are
   * counted.
   */
  "index:progress": { done: number; total: number };
  /** The startup scan is done. Not sent if it fails: see `indexStatus`. */
  "index:ready": undefined;
  /**
   * After the startup scan, the index took in notes that were saved,
   * created, moved or deleted, here or by other programs. Answers from
   * `links` may differ now.
   */
  "index:updated": undefined;
  /** An open note changed on disk while it has unsaved edits. */
  conflict: { path: NotePath };
  /**
   * This vault object rewrote a note on its own, not for its editor: the
   * links in it to a note that moved, or a tag that was renamed. An editor
   * that shows the note reads it again, as after a change by another
   * program.
   */
  rewritten: { path: NotePath };
  /**
   * This vault object added, moved or deleted a note, file or folder, so
   * `tree()` now gives another result. Together with `changed`, which
   * covers everyone else, it tells when to list the vault again.
   */
  tree: undefined;
  /** The trash got, gave back or dropped something: `trash.list()` differs. */
  trash: undefined;
  /** The bookmarks changed: `bookmarks.list()` differs. */
  bookmarks: undefined;
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
 * The single entry point for the UI (ARCHITECTURE.md, section 6).
 */
export class Vault {
  /** Absolute path of the vault folder, `/` separated. */
  readonly root: string;
  readonly notes: Notes;
  readonly folders: Folders;
  readonly attachments: Attachments;
  readonly links: Links;
  readonly search: Search;
  readonly tags: Tags;
  readonly graph: Graph;
  /** Deleted notes, files and folders, until restored or emptied. */
  readonly trash: VaultTrash;
  /** The notes and files marked as bookmarks. */
  readonly bookmarks: Bookmarks;

  private readonly platform: Platform;
  private readonly emitter = new Emitter<VaultEvents>();
  private readonly watch: VaultWatch;
  private isWatching = false;
  private cachedTree: Promise<TreeNode[]> | null = null;
  private cachedDrafts: Promise<TreeNode[]> | null = null;
  private closed = false;
  /** Keeps the index up to date, once it is open. */
  private indexer: Indexer | null = null;
  /** The index, once `startIndexing` has started to open it. */
  private store: Promise<IndexStore> | null = null;
  private status: IndexStatus = { state: "scanning", done: 0, total: null };
  /** Opening the index and the startup scan; see `indexed()`. */
  private indexing: Promise<void> = Promise.resolve();

  private constructor(root: string, platform: Platform, delayMs: number) {
    const { fs, watcher, trash: systemTrash } = platform;
    const forgetTree = () => {
      this.cachedTree = null;
      this.cachedDrafts = null;
    };
    const own = new OwnChanges(
      fs,
      () => {
        forgetTree();
        this.emitter.emit("tree", undefined);
      },
      (path) => {
        const relative = path.slice(root.length + 1);
        // The trash and the rest of `.carbon` are not indexed.
        if (isVaultPath(relative)) this.indexer?.touched(relative);
      },
    );
    const trash = new VaultTrash({
      root,
      fs,
      own,
      systemTrash,
      onChange: () => this.emitter.emit("trash", undefined),
    });
    this.trash = trash;
    const bookmarks = new Bookmarks({
      root,
      fs,
      onChange: () => this.emitter.emit("bookmarks", undefined),
    });
    this.bookmarks = bookmarks;

    this.root = root;
    this.platform = platform;
    const caughtUp = async () => {
      await this.indexed();
      if (this.store === null)
        throw new VaultError("indexNotOpen", "", "The index is not open");
      return this.store;
    };
    /** `Notes.write` for a note the vault changes on its own. */
    const rewrite = async (path: NotePath, text: string, baseHash: string) => {
      const hash = await this.notes.write(path, text, baseHash);
      this.emitter.emit("rewritten", { path });
      return hash;
    };
    const rewriter = new LinkRewriter({
      index: caughtUp,
      read: (path) => this.notes.read(path),
      write: rewrite,
    });
    const context = { root, fs, trash, systemTrash, bookmarks, own };
    this.notes = new Notes(context, rewriter);
    this.folders = new Folders(context, rewriter);
    this.attachments = new Attachments(context);
    const index = () =>
      this.store ??
      Promise.reject(
        new VaultError("indexNotOpen", "", "The index is not open"),
      );
    this.links = new Links({
      index,
      caughtUp,
      createNote: (path) => this.notes.create(path),
      read: (path) => this.notes.read(path),
      write: (path, text, baseHash) => this.notes.write(path, text, baseHash),
    });
    this.search = new Search({
      index,
      read: (path) => this.notes.read(path),
      tree: () => this.tree(),
    });
    this.tags = new Tags({
      index,
      caughtUp,
      read: (path) => this.notes.read(path),
      write: rewrite,
    });
    this.graph = new Graph({ index });
    this.watch = new VaultWatch({
      root,
      fs,
      watcher,
      own,
      delayMs,
      onActivity: forgetTree,
      onChange: (change) => {
        this.indexer?.touched(change.path);
        this.emitter.emit("changed", change);
      },
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
    // Moved or deleted since it was last open: a clear error, not the one
    // of the file system.
    if (!(await platform.fs.exists(normalized))) {
      throw new VaultError(
        "vaultMissing",
        normalized,
        `No vault folder at ${normalized}`,
      );
    }
    const stat = await platform.fs.stat(normalized);
    if (stat.kind !== "dir") {
      throw new VaultError(
        "notAFolder",
        normalized,
        `Vault root is not a folder: ${normalized}`,
      );
    }
    const vault = new Vault(
      normalized,
      platform,
      options.changeDelayMs ?? DEFAULT_CHANGE_DELAY_MS,
    );
    try {
      // Where the vault settings, the drafts and the trash live (4.1). The
      // drafts folder is made too, so notes can be moved into it.
      await platform.fs.mkdir(`${normalized}/${DRAFTS_FOLDER}`);
    } catch {
      // A vault on a read-only drive still opens, to be read.
    }
    try {
      await vault.watch.start();
      vault.isWatching = true;
    } catch {
      // Without a watcher the vault works, it only cannot see outside
      // changes. The UI can tell the user through `watching`.
    }
    vault.startIndexing();
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
      throw new VaultError("alreadyExists", root, `Already exists: ${root}`);
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

  /**
   * The drafts (ADR-031): the tree of `DRAFTS_FOLDER`, which `tree()`
   * leaves out, with paths relative to the vault root. Empty while the
   * folder does not exist. Cached as `tree()` is.
   */
  drafts(): Promise<TreeNode[]> {
    const { fs } = this.platform;
    if (!this.isWatching) return scanTree(fs, this.root, DRAFTS_FOLDER);
    this.cachedDrafts ??= scanTree(fs, this.root, DRAFTS_FOLDER);
    return this.cachedDrafts;
  }

  /**
   * Resolves when the index has caught up with the vault: the startup scan
   * and every change seen so far are in it. Rejects if the index could not
   * be opened or the startup scan failed; the notes work without it.
   */
  async indexed(): Promise<void> {
    await this.indexing;
    await this.indexer?.idle();
  }

  /**
   * Where the index is now. The scan starts while `open` resolves, so
   * events can come before anyone listens: read this after subscribing to
   * `index:progress` and `index:ready`.
   */
  get indexStatus(): IndexStatus {
    return this.status;
  }

  /** Subscribes to a vault event. Returns a function that unsubscribes. */
  on<K extends keyof VaultEvents>(
    event: K,
    listener: (payload: VaultEvents[K]) => void,
  ): () => void {
    return this.emitter.on(event, listener);
  }

  /**
   * Opens the index and runs the startup scan in the background: the vault
   * is usable at once, and the index catches up (ARCHITECTURE.md, 5).
   */
  private startIndexing(): void {
    const { platform, root } = this;
    const started = Date.now();
    this.store = IndexStore.open(platform, root);
    // A failure is reported by `indexed()` and the queries, not here.
    this.store.catch(() => {});
    this.indexing = this.store
      .then(async (store): Promise<ScanResult | undefined> => {
        if (this.closed) {
          await store.close();
          return undefined;
        }
        // At once, so no change made from now on is missed: a change made
        // before is seen by the scan.
        this.indexer = new Indexer({
          fs: platform.fs,
          root,
          store,
          parser: platform.parser ?? inlineParser,
          onUpdated: () => {
            this.search.indexChanged();
            this.emitter.emit("index:updated", undefined);
          },
        });
        // The aliases the index kept from the last time, before the scan.
        this.search.indexChanged();
        return this.indexer.scan((progress) => {
          this.status = { state: "scanning", ...progress };
          this.emitter.emit("index:progress", progress);
        });
      })
      .then(
        (scan) => {
          if (this.closed || scan === undefined) return;
          const doneAt = Date.now();
          this.status = {
            state: "ready",
            notes: scan.notes,
            indexed: scan.indexed,
            ms: doneAt - started,
            doneAt,
            waits: scan.waits,
          };
          this.search.indexChanged();
          this.emitter.emit("index:ready", undefined);
        },
        (error: unknown) => {
          this.status = { state: "failed", error };
          throw error;
        },
      );
    // A failure is reported through `indexed()`, not as an unhandled one.
    this.indexing.catch(() => {});
  }

  close(): void {
    this.closed = true;
    this.watch.stop();
    this.isWatching = false;
    this.cachedTree = null;
    this.cachedDrafts = null;
    this.emitter.clear();
    void this.indexer?.close().catch(() => {});
    this.indexer = null;
    this.store = null;
  }
}
