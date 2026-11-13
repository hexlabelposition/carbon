import type { FileSystem, NoteParser } from "../platform";
import type { NotePath } from "../types";
import type { IndexStore } from "./index-store";
import {
  scanVault,
  updateNotes,
  type IndexContext,
  type ScanOptions,
} from "./scan";

export interface IndexerOptions {
  fs: FileSystem;
  root: string;
  store: IndexStore;
  parser: NoteParser;
  /** After each step that indexed what was touched, failed or not. */
  onUpdated?: () => void;
}

/**
 * Keeps the index of an open vault up to date: the startup scan first,
 * then every path the vault or another program touched (ARCHITECTURE.md,
 * section 5). The work runs one step at a time, so two steps never write
 * the same note at once.
 */
export class Indexer {
  /** The last step; each new one starts after it. */
  private work: Promise<unknown> = Promise.resolve();
  /** Paths touched since the last update was queued. */
  private dirty = new Set<string>();
  private queued = false;
  private closed = false;
  private readonly context: IndexContext;
  private readonly onUpdated: () => void;

  constructor({ onUpdated, ...options }: IndexerOptions) {
    this.context = { ...options, cancelled: () => this.closed };
    this.onUpdated = onUpdated ?? (() => {});
  }

  /** Runs the startup scan. Paths touched meanwhile are handled after it. */
  scan(onProgress?: ScanOptions["onProgress"]): Promise<void> {
    const scan = this.after(async () => {
      await scanVault({ ...this.context, onProgress });
    });
    // The work goes on after a failed scan; the failure is the caller's.
    this.work = scan.catch(() => {});
    return scan;
  }

  /**
   * Something at `path`, relative to the vault root, was added, changed or
   * removed: a note, a folder, or another file. Paths touched in a burst
   * are handled together.
   */
  touched(path: string): void {
    if (this.closed) return;
    this.dirty.add(path);
    if (this.queued) return;
    this.queued = true;
    this.work = this.after(() => this.update()).catch(() => {
      // A step that fails leaves the index behind until the next start,
      // whose scan repairs it. It never stops the steps after it.
    });
  }

  /** Resolves when every step queued so far, and after it, is done. */
  async idle(): Promise<void> {
    let last: Promise<unknown>;
    do {
      last = this.work;
      await last;
    } while (last !== this.work);
  }

  /** Stops after the current step and closes the index. */
  async close(): Promise<void> {
    this.closed = true;
    this.dirty.clear();
    await this.idle();
    await this.context.store.close();
  }

  private after<T>(step: () => Promise<T>): Promise<T> {
    return this.work.then(() => (this.closed ? (undefined as T) : step()));
  }

  private async update(): Promise<void> {
    this.queued = false;
    const paths = withoutNested([...this.dirty]);
    this.dirty.clear();
    try {
      for (const path of paths) {
        if (this.closed) return;
        await this.updatePath(path);
      }
    } finally {
      // A failed step may still have written some of its paths.
      if (!this.closed) this.onUpdated();
    }
  }

  private async updatePath(path: string): Promise<void> {
    const { fs, root, store } = this.context;
    const stat = await fs.stat(`${root}/${path}`).catch(() => null);
    if (stat?.kind === "dir") {
      // A folder that was added or moved here: whatever is inside.
      await scanVault({ ...this.context, folder: path });
    } else if (stat === null) {
      // Gone: a note, or a folder with notes inside.
      const inside = [...(await store.stamps(path)).keys()];
      await store.removeNotes([path, ...inside]);
    } else if (isNote(path)) {
      const stamp = await store.stamp(path);
      await updateNotes(
        this.context,
        [path],
        new Map(stamp === null ? [] : [[path, stamp]]),
      );
    }
  }
}

function isNote(path: NotePath): boolean {
  return /\.md$/i.test(path);
}

/** Drops paths inside other paths of the list: the folder covers them. */
function withoutNested(paths: string[]): string[] {
  const all = new Set(paths);
  const inListed = (path: string) => {
    for (
      let at = path.lastIndexOf("/");
      at > 0;
      at = path.lastIndexOf("/", at - 1)
    ) {
      if (all.has(path.slice(0, at))) return true;
    }
    return false;
  };
  return [...all].filter((path) => !inListed(path)).sort();
}
