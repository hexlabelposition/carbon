import type { Platform, SqlDatabase, SqlValue } from "../platform";
import type { Heading, Link, NotePath, ParsedNote } from "../types";
import { contentHash } from "../util/hash";
import { normalizeRoot } from "../vault/path";

/** What the file of a note looked like when it was indexed. */
export interface NoteStamp {
  /** Last change, in milliseconds since the epoch. */
  mtime: number;
  /** Size in bytes. */
  size: number;
  /** `contentHash` of the text. */
  hash: string;
}

/** A note to index: what the parser found, and the file it came from. */
export interface IndexEntry {
  note: ParsedNote;
  stamp: NoteStamp;
}

/**
 * Bump on every change to `SCHEMA`. An index of another version is thrown
 * away and built again: it is a cache, so it needs no migrations
 * (ARCHITECTURE.md, section 5).
 */
export const SCHEMA_VERSION = 1;

/**
 * Notes, their headings and their links, as the parser found them. Links
 * keep their target as written; resolving it is C-207, full-text search
 * C-301, tags and the rest of the frontmatter M4. Each adds its tables
 * with a new schema version.
 */
const SCHEMA = [
  `CREATE TABLE notes (
     id INTEGER PRIMARY KEY,
     path TEXT NOT NULL UNIQUE,
     title TEXT NOT NULL,
     mtime INTEGER NOT NULL,
     size INTEGER NOT NULL,
     hash TEXT NOT NULL
   )`,
  `CREATE TABLE headings (
     note_id INTEGER NOT NULL,
     level INTEGER NOT NULL,
     text TEXT NOT NULL,
     pos INTEGER NOT NULL
   )`,
  `CREATE INDEX headings_note ON headings (note_id)`,
  `CREATE TABLE links (
     source_id INTEGER NOT NULL,
     target_raw TEXT NOT NULL,
     alias TEXT,
     fragment TEXT,
     pos_start INTEGER NOT NULL,
     pos_end INTEGER NOT NULL
   )`,
  `CREATE INDEX links_source ON links (source_id)`,
  `CREATE INDEX links_target ON links (target_raw COLLATE NOCASE)`,
];

/**
 * Rows in one `INSERT`. The plugin makes every statement a transaction of
 * its own, so writing row by row is far too slow; 1,000 rows was the
 * fastest size measured in M0 (ARCHITECTURE.md, section 7).
 */
const ROWS_PER_INSERT = 1000;
/** Paths in one `IN (...)` list, well below SQLite's limit of parameters. */
const PATHS_PER_QUERY = 500;

/**
 * The index of one vault, in SQLite (ADR-009). The database is a cache in
 * the app cache directory, one file per vault: the files of the vault are
 * the truth, and the startup scan repairs whatever the index missed.
 *
 * Writing one note takes several statements and is not atomic. A crash in
 * between leaves that note half indexed until the next scan, which is
 * acceptable for a cache (ARCHITECTURE.md, section 7).
 */
export class IndexStore {
  private constructor(
    private readonly db: SqlDatabase,
    /** True when the index was empty or of another version, and is new. */
    readonly created: boolean,
  ) {}

  /** Opens the index of the vault at `root`, creating it if needed. */
  static async open(platform: Platform, root: string): Promise<IndexStore> {
    const db = await platform.sql.open(indexFileName(root));
    try {
      return await IndexStore.openDatabase(db);
    } catch (error) {
      await db.close().catch(() => {});
      throw error;
    }
  }

  /** Uses an open database; for tests and for `open`. */
  static async openDatabase(db: SqlDatabase): Promise<IndexStore> {
    const [{ user_version }] = await db.select<{ user_version: number }>(
      "PRAGMA user_version",
    );
    if (user_version === SCHEMA_VERSION) return new IndexStore(db, false);

    await dropEverything(db);
    // Kept in the file: set once, every connection of the pool has it.
    await db.select("PRAGMA journal_mode = WAL");
    for (const statement of SCHEMA) await db.execute(statement);
    // Last: a crash before this line leaves a version that is rebuilt.
    await db.execute(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    return new IndexStore(db, true);
  }

  /**
   * The stamps of every indexed note, or of the notes inside `folder`:
   * what a scan compares with the files.
   */
  async stamps(folder = ""): Promise<Map<NotePath, NoteStamp>> {
    const prefix = folder === "" ? "" : `${folder}/`;
    // Not LIKE: "%" and "_" are fine in a file name.
    const rows = await this.db.select<{ path: string } & NoteStamp>(
      `SELECT path, mtime, size, hash FROM notes
       WHERE substr(path, 1, length(?)) = ?`,
      [prefix, prefix],
    );
    return new Map(
      rows.map(({ path, mtime, size, hash }) => [path, { mtime, size, hash }]),
    );
  }

  /** The stamp of one note, or `null` if it is not indexed. */
  async stamp(path: NotePath): Promise<NoteStamp | null> {
    const [row] = await this.db.select<NoteStamp>(
      "SELECT mtime, size, hash FROM notes WHERE path = ?",
      [path],
    );
    return row ?? null;
  }

  /**
   * Indexes notes, or indexes them again: every row of a note that was
   * indexed before is replaced. A note keeps its row id, so rows of other
   * notes that point at it stay valid.
   */
  async replaceNotes(entries: readonly IndexEntry[]): Promise<void> {
    // A path given twice: the last entry wins, as if written one by one.
    const byPath = new Map(entries.map((entry) => [entry.note.path, entry]));
    for (const chunk of chunks([...byPath.values()], PATHS_PER_QUERY)) {
      await this.replaceChunk(chunk);
    }
  }

  /** Forgets notes and every row that belongs to them. */
  async removeNotes(paths: readonly NotePath[]): Promise<void> {
    for (const chunk of chunks([...new Set(paths)], PATHS_PER_QUERY)) {
      await this.deleteRowsOf(chunk);
      await this.db.execute(
        `DELETE FROM notes WHERE path IN (${marks(chunk.length)})`,
        chunk,
      );
    }
  }

  /** The headings of a note, in order. Empty if it is not indexed. */
  async headings(path: NotePath): Promise<Heading[]> {
    return this.db.select<Heading>(
      `SELECT h.level, h.text, h.pos FROM headings h
       JOIN notes n ON n.id = h.note_id
       WHERE n.path = ? ORDER BY h.pos`,
      [path],
    );
  }

  /** The links of a note, in order. Empty if it is not indexed. */
  async outgoingLinks(path: NotePath): Promise<Link[]> {
    return this.db.select<Link>(
      `SELECT l.target_raw AS target, l.alias, l.fragment,
              l.pos_start AS start, l.pos_end AS "end"
       FROM links l JOIN notes n ON n.id = l.source_id
       WHERE n.path = ? ORDER BY l.pos_start`,
      [path],
    );
  }

  close(): Promise<void> {
    return this.db.close();
  }

  private async replaceChunk(entries: readonly IndexEntry[]): Promise<void> {
    const paths = entries.map((entry) => entry.note.path);
    await this.deleteRowsOf(paths);

    // An upsert, not delete and insert: the note keeps its id.
    await insertRows(
      this.db,
      "notes (path, title, mtime, size, hash)",
      entries.map(({ note, stamp }) => [
        note.path,
        note.title,
        stamp.mtime,
        stamp.size,
        stamp.hash,
      ]),
      `ON CONFLICT (path) DO UPDATE SET title = excluded.title,
         mtime = excluded.mtime, size = excluded.size, hash = excluded.hash`,
    );

    const ids = new Map(
      (
        await this.db.select<{ id: number; path: string }>(
          `SELECT id, path FROM notes WHERE path IN (${marks(paths.length)})`,
          paths,
        )
      ).map(({ id, path }) => [path, id]),
    );
    const idOf = (path: NotePath) => {
      const id = ids.get(path);
      if (id === undefined) throw new Error(`Note not indexed: ${path}`);
      return id;
    };

    await insertRows(
      this.db,
      "headings (note_id, level, text, pos)",
      entries.flatMap(({ note }) =>
        note.headings.map((h) => [idOf(note.path), h.level, h.text, h.pos]),
      ),
    );
    await insertRows(
      this.db,
      "links (source_id, target_raw, alias, fragment, pos_start, pos_end)",
      entries.flatMap(({ note }) =>
        note.links.map((l) => [
          idOf(note.path),
          l.target,
          l.alias,
          l.fragment,
          l.start,
          l.end,
        ]),
      ),
    );
  }

  /** Deletes the headings and links of notes, not the notes themselves. */
  private async deleteRowsOf(paths: readonly NotePath[]): Promise<void> {
    const ofNotes = `(SELECT id FROM notes WHERE path IN (${marks(paths.length)}))`;
    await this.db.execute(
      `DELETE FROM headings WHERE note_id IN ${ofNotes}`,
      paths,
    );
    await this.db.execute(
      `DELETE FROM links WHERE source_id IN ${ofNotes}`,
      paths,
    );
  }
}

/**
 * The database file of a vault: named by a hash of its path, so the name
 * is short, safe on every system, and the same on every start.
 */
export function indexFileName(root: string): string {
  return `index-${contentHash(normalizeRoot(root)).slice(0, 16)}.db`;
}

/** Drops every table, whatever version made it. */
async function dropEverything(db: SqlDatabase): Promise<void> {
  const tables = await db.select<{ name: string; sql: string | null }>(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );
  // A virtual table first: dropping it drops the tables behind it.
  const virtualFirst = [...tables].sort(
    (a, b) => Number(isVirtual(b)) - Number(isVirtual(a)),
  );
  for (const { name } of virtualFirst) {
    await db.execute(`DROP TABLE IF EXISTS "${name.replaceAll('"', '""')}"`);
  }
}

function isVirtual(table: { sql: string | null }): boolean {
  return /^CREATE VIRTUAL TABLE/i.test(table.sql ?? "");
}

async function insertRows(
  db: SqlDatabase,
  into: string,
  rows: readonly SqlValue[][],
  suffix = "",
): Promise<void> {
  for (const chunk of chunks(rows, ROWS_PER_INSERT)) {
    const tuple = `(${marks(chunk[0].length)})`;
    await db.execute(
      `INSERT INTO ${into} VALUES ${Array(chunk.length).fill(tuple).join(", ")} ${suffix}`,
      chunk.flat(),
    );
  }
}

/** `?, ?, ?` for `count` parameters. */
function marks(count: number): string {
  return Array(count).fill("?").join(", ");
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
