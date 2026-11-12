import { parseNote } from "../parser/parse-note";
import type { FileSystem, Stat } from "../platform";
import type { NotePath } from "../types";
import { contentHash } from "../util/hash";
import { mapPool } from "../util/pool";
import { scanTree, type TreeNode } from "../vault/tree";
import type { IndexEntry, IndexStore, NoteStamp } from "./index-store";

/**
 * Files read or looked at the same time. Reading is flat beyond 64 in
 * flight (ARCHITECTURE.md, section 7).
 */
const FILE_CONCURRENCY = 64;
/** Notes read, parsed and written together. */
const BATCH = 200;

export interface ScanOptions {
  fs: FileSystem;
  /** The vault folder, normalized. */
  root: string;
  store: IndexStore;
  /** After each batch: notes indexed so far, of the notes to index. */
  onProgress?: (progress: { done: number; total: number }) => void;
  /** Checked between steps: true stops the scan where it is. */
  cancelled?: () => boolean;
}

export interface ScanResult {
  /** Notes in the vault. */
  notes: number;
  /** Notes that were new or changed, and were indexed. */
  indexed: number;
  /** Notes that were in the index but are gone from the vault. */
  removed: number;
}

/**
 * Brings the index up to date with the vault (ARCHITECTURE.md, section 5):
 * notes whose size or modification time differ from the index are read
 * and indexed again, notes that are gone are dropped, the rest is not
 * touched. On the first start every note is new.
 *
 * A note that cannot be read is left out of the index, as if it were
 * gone; the next scan tries it again.
 */
export async function scanVault(options: ScanOptions): Promise<ScanResult> {
  const { fs, root, store, onProgress } = options;
  const cancelled = options.cancelled ?? (() => false);
  const result: ScanResult = { notes: 0, indexed: 0, removed: 0 };

  const [paths, known] = await Promise.all([
    scanTree(fs, root).then(notePaths),
    store.stamps(),
  ]);
  result.notes = paths.length;
  if (cancelled()) return result;

  const present = new Set(paths);
  const gone = [...known.keys()].filter((path) => !present.has(path));

  const stats = await mapPool(paths, FILE_CONCURRENCY, (path) =>
    fs.stat(`${root}/${path}`).catch(() => null),
  );
  const toIndex: { path: NotePath; stat: Stat }[] = [];
  paths.forEach((path, i) => {
    const stat = stats[i];
    // Gone between listing and looking.
    if (stat === null) gone.push(path);
    else if (!sameFile(known.get(path), stat)) toIndex.push({ path, stat });
  });

  const indexedOnly = (list: NotePath[]) =>
    list.filter((path) => known.has(path));
  result.removed = indexedOnly(gone).length;
  await store.removeNotes(indexedOnly(gone));
  if (cancelled()) return result;

  onProgress?.({ done: 0, total: toIndex.length });
  for (let i = 0; i < toIndex.length; i += BATCH) {
    const batch = toIndex.slice(i, i + BATCH);
    const read = await mapPool(batch, FILE_CONCURRENCY, ({ path }) =>
      fs.readText(`${root}/${path}`).catch(() => null),
    );
    const entries: IndexEntry[] = [];
    const unreadable: NotePath[] = [];
    batch.forEach(({ path, stat }, j) => {
      const text = read[j];
      if (text === null) {
        unreadable.push(path);
        return;
      }
      entries.push({
        note: parseNote(path, text),
        stamp: { mtime: stat.mtime, size: stat.size, hash: contentHash(text) },
      });
    });
    if (cancelled()) return result;

    await store.replaceNotes(entries);
    await store.removeNotes(indexedOnly(unreadable));
    result.indexed += entries.length;
    result.removed += indexedOnly(unreadable).length;
    onProgress?.({ done: i + batch.length, total: toIndex.length });
  }
  return result;
}

/** The size and time of the file are what the index has for it. */
function sameFile(stamp: NoteStamp | undefined, stat: Stat): boolean {
  return (
    stamp !== undefined &&
    stamp.mtime === stat.mtime &&
    stamp.size === stat.size
  );
}

/** Every note in the tree, by path. */
function notePaths(tree: TreeNode[]): NotePath[] {
  const paths: NotePath[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === "folder") walk(node.children);
      else if (node.kind === "note") paths.push(node.path);
    }
  };
  walk(tree);
  return paths;
}
