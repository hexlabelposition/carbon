import type { FileSystem, NoteFile, NoteParser, Stat } from "../platform";
import type { NotePath } from "../types";
import { mapPool } from "../util/pool";
import type { IndexEntry, IndexStore, NoteStamp } from "./index-store";

/**
 * Files read or looked at the same time. Reading is flat beyond 64 in
 * flight (ARCHITECTURE.md, section 7).
 */
const FILE_CONCURRENCY = 64;
/** Notes read, parsed and written together. */
const BATCH = 200;

/** What indexing needs: where the vault is, and where the index goes. */
export interface IndexContext {
  fs: FileSystem;
  /** The vault folder, normalized. */
  root: string;
  store: IndexStore;
  /** Parses and hashes the notes that are read. */
  parser: NoteParser;
  /** Checked between steps: true stops the work where it is. */
  cancelled?: () => boolean;
}

export interface ScanOptions extends IndexContext {
  /** A folder of the vault to scan instead of the whole vault. */
  folder?: string;
  /** After each batch: notes indexed so far, of the notes to index. */
  onProgress?: (progress: { done: number; total: number }) => void;
}

export interface ScanResult {
  /** Notes in the vault, or in the folder. */
  notes: number;
  /** Notes that were new or changed, and were indexed. */
  indexed: number;
  /** Notes that were in the index but are gone from the vault. */
  removed: number;
}

/**
 * Brings the index up to date with the vault, or with one folder of it
 * (ARCHITECTURE.md, section 5): notes that are gone are dropped, the rest
 * go through `updateNotes`. On the first start every note is new.
 */
export async function scanVault(options: ScanOptions): Promise<ScanResult> {
  const { fs, root, store, folder = "", onProgress } = options;
  const cancelled = options.cancelled ?? (() => false);

  // One call for every note with its size and time (ADR-028): no `stat`
  // for each of them below.
  const prefix = folder === "" ? "" : `${folder}/`;
  const [listed, known] = await Promise.all([
    fs.listNotes(folder === "" ? root : `${root}/${folder}`),
    store.stamps(folder),
  ]);
  const stats = new Map<NotePath, Stat>(
    listed.map(({ path, size, mtime }) => [
      prefix + path,
      { kind: "file", size, mtime },
    ]),
  );
  const paths = [...stats.keys()].sort();
  if (cancelled()) return { notes: paths.length, indexed: 0, removed: 0 };

  const present = new Set(paths);
  const gone = [...known.keys()].filter((path) => !present.has(path));
  await store.removeNotes(gone);
  if (cancelled()) {
    return { notes: paths.length, indexed: 0, removed: gone.length };
  }

  const updated = await updateNotes(options, paths, known, onProgress, stats);
  return {
    notes: paths.length,
    indexed: updated.indexed,
    removed: gone.length + updated.removed,
  };
}

/**
 * Indexes the notes at `paths` whose size or modification time differ
 * from `known`, the stamps the index has for them. A note that is gone,
 * or cannot be read, is dropped from the index; the next scan tries it
 * again.
 */
export async function updateNotes(
  context: IndexContext,
  paths: readonly NotePath[],
  known: ReadonlyMap<NotePath, NoteStamp>,
  onProgress?: ScanOptions["onProgress"],
  /** The stats of `paths` if they are known already, as from `listNotes`. */
  listed?: ReadonlyMap<NotePath, Stat>,
): Promise<{ indexed: number; removed: number }> {
  const { fs, root, store, parser } = context;
  const cancelled = context.cancelled ?? (() => false);
  const result = { indexed: 0, removed: 0 };
  const indexedOnly = (list: NotePath[]) =>
    list.filter((path) => known.has(path));

  const stats =
    listed === undefined
      ? await mapPool(paths, FILE_CONCURRENCY, (path) =>
          fs.stat(`${root}/${path}`).catch(() => null),
        )
      : paths.map((path) => listed.get(path) ?? null);
  const gone: NotePath[] = [];
  const toIndex: { path: NotePath; stat: Stat }[] = [];
  paths.forEach((path, i) => {
    const stat = stats[i];
    if (stat === null || stat.kind !== "file") gone.push(path);
    else if (!sameFile(known.get(path), stat)) toIndex.push({ path, stat });
  });
  result.removed = indexedOnly(gone).length;
  await store.removeNotes(indexedOnly(gone));
  if (cancelled()) return result;

  onProgress?.({ done: 0, total: toIndex.length });

  /** Reads a batch; a note that cannot be read is set apart. */
  const readBatch = async (batch: typeof toIndex) => {
    const read = await mapPool(batch, FILE_CONCURRENCY, ({ path }) =>
      fs.readText(`${root}/${path}`).catch(() => null),
    );
    const files: NoteFile[] = [];
    const readStats: Stat[] = [];
    const unreadable: NotePath[] = [];
    batch.forEach(({ path, stat }, j) => {
      const text = read[j];
      if (text === null) {
        unreadable.push(path);
      } else {
        files.push({ path, text });
        readStats.push(stat);
      }
    });
    return { files, readStats, unreadable };
  };

  // A pipeline (C-602): while one batch is parsed, the one before it is
  // written and the one after it is read. Writes stay one after another.
  let reading = toIndex.length > 0 ? readBatch(toIndex.slice(0, BATCH)) : null;
  let writing: Promise<void> = Promise.resolve();
  for (let i = 0; reading !== null; i += BATCH) {
    const { files, readStats, unreadable } = await reading;
    const next = i + BATCH;
    reading =
      next < toIndex.length
        ? readBatch(toIndex.slice(next, next + BATCH))
        : null;
    const parsed = await parser.parse(files);
    const entries: IndexEntry[] = parsed.map(({ note, hash }, j) => ({
      note,
      stamp: { mtime: readStats[j].mtime, size: readStats[j].size, hash },
    }));
    await writing;
    if (cancelled()) return result;

    const done = Math.min(next, toIndex.length);
    writing = (async () => {
      await store.replaceNotes(entries);
      await store.removeNotes(indexedOnly(unreadable));
      result.indexed += entries.length;
      result.removed += indexedOnly(unreadable).length;
      onProgress?.({ done, total: toIndex.length });
    })();
    // Not left without a handler while the next batch is parsed: a failed
    // write still rejects, when it is awaited.
    writing.catch(() => {});
  }
  await writing;
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
