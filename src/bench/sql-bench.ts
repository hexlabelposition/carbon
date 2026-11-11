import type { FileSystem } from "@carbon/core";
import type { Database } from "../platform";
import { mapPool, scanMarkdown } from "./read-bench";

interface Note {
  id: number;
  path: string;
  title: string;
  body: string;
  links: {
    target: string;
    fragment: string | null;
    alias: string | null;
    start: number;
    end: number;
  }[];
}

const WIKI_LINK = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

/** Reads the vault and extracts what the index would store. Not a real parser. */
export async function loadNotes(fs: FileSystem, root: string): Promise<Note[]> {
  const paths = await scanMarkdown(fs, root, 16);
  return mapPool(paths, 32, async (path) => {
    const body = await fs.readText(path);
    const links = [...body.matchAll(WIKI_LINK)].map((m) => ({
      target: m[1],
      fragment: m[2] ?? null,
      alias: m[3] ?? null,
      start: m.index,
      end: m.index + m[0].length,
    }));
    const name = path.slice(path.lastIndexOf("/") + 1, -".md".length);
    return {
      id: 0,
      path: path.slice(root.length + 1),
      title: name,
      body,
      links,
    };
  }).then((notes) => notes.map((note, i) => ({ ...note, id: i + 1 })));
}

const SCHEMA = [
  `CREATE TABLE bench_notes(id INTEGER PRIMARY KEY, path TEXT UNIQUE, title TEXT,
     mtime INTEGER, size INTEGER, hash TEXT)`,
  `CREATE TABLE bench_links(source_id INTEGER, target_raw TEXT, alias TEXT, fragment TEXT,
     pos_start INTEGER, pos_end INTEGER)`,
  `CREATE INDEX bench_links_target ON bench_links(target_raw)`,
  `CREATE INDEX bench_links_source ON bench_links(source_id)`,
  `CREATE VIRTUAL TABLE bench_fts USING fts5(title, body)`,
];
const TABLES = ["bench_fts", "bench_links", "bench_notes"];

export async function dropTables(db: Database): Promise<void> {
  for (const table of TABLES) await db.execute(`DROP TABLE IF EXISTS ${table}`);
}

export async function createTables(db: Database): Promise<void> {
  await dropTables(db);
  for (const statement of SCHEMA) await db.execute(statement);
}

/**
 * One multi-row INSERT per chunk. The plugin has no transaction API and uses
 * a connection pool, so BEGIN and COMMIT sent as separate calls may land on
 * different connections. A single statement is its own transaction.
 */
async function insertRows(
  db: Database,
  table: string,
  columns: number,
  rows: unknown[][],
  batch: number,
): Promise<number> {
  const tuple = `(${Array(columns).fill("?").join(",")})`;
  let calls = 0;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await db.execute(
      `INSERT INTO ${table} VALUES ${Array(chunk.length).fill(tuple).join(",")}`,
      chunk.flat(),
    );
    calls++;
  }
  return calls;
}

export interface InsertResult {
  ms: number;
  notes: number;
  links: number;
  calls: number;
}

/** Fills empty tables with `notes`, `batch` rows per INSERT. */
export async function insertNotes(
  db: Database,
  notes: readonly Note[],
  batch: number,
): Promise<InsertResult> {
  const noteRows = notes.map((n) => [
    n.id,
    n.path,
    n.title,
    0,
    n.body.length,
    "",
  ]);
  const ftsRows = notes.map((n) => [n.id, n.title, n.body]);
  const linkRows = notes.flatMap((n) =>
    n.links.map((l) => [n.id, l.target, l.alias, l.fragment, l.start, l.end]),
  );

  const start = performance.now();
  const calls =
    (await insertRows(db, "bench_notes", 6, noteRows, batch)) +
    (await insertRows(db, "bench_fts(rowid, title, body)", 3, ftsRows, batch)) +
    (await insertRows(db, "bench_links", 6, linkRows, batch));
  return {
    ms: performance.now() - start,
    notes: notes.length,
    links: linkRows.length,
    calls,
  };
}

/** Replaces one note's rows, the way a save would. */
export async function reindexOne(db: Database, note: Note): Promise<number> {
  const start = performance.now();
  await db.execute("DELETE FROM bench_links WHERE source_id = ?", [note.id]);
  await db.execute("DELETE FROM bench_fts WHERE rowid = ?", [note.id]);
  await db.execute("DELETE FROM bench_notes WHERE id = ?", [note.id]);
  await insertNotes(db, [note], 1000);
  return performance.now() - start;
}

export async function median(
  times: number,
  fn: () => Promise<unknown>,
): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < times; i++) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b)[Math.floor(times / 2)];
}

export function searchFts(
  db: Database,
  query: string,
): Promise<{ rowid: number; snippet: string }[]> {
  return db.select(
    `SELECT rowid, snippet(bench_fts, 1, '[', ']', '…', 12) AS snippet
       FROM bench_fts WHERE bench_fts MATCH ? ORDER BY rank LIMIT 20`,
    [query],
  );
}

export function backlinks(
  db: Database,
  title: string,
): Promise<{ path: string }[]> {
  return db.select(
    `SELECT n.path, l.pos_start FROM bench_links l JOIN bench_notes n ON n.id = l.source_id
      WHERE l.target_raw = ?`,
    [title],
  );
}
