import type { Platform, SqlDatabase, SqlValue } from "../platform";
import { linkKeys, matchKey, noteKeys } from "../links/resolve";
import type { Heading, NotePath, OutgoingLink, ParsedNote } from "../types";
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
export const SCHEMA_VERSION = 2;

/**
 * Notes, their headings, aliases and links. A link keeps its target as
 * written, the keys it is matched by (`links/resolve.ts`), and the note it
 * resolves to: `target_id` is `NULL` while that note does not exist.
 * Full-text search is C-301, tags and the rest of the frontmatter M4. Each
 * adds its tables with a new schema version.
 */
const SCHEMA = [
  `CREATE TABLE notes (
     id INTEGER PRIMARY KEY,
     path TEXT NOT NULL UNIQUE,
     title TEXT NOT NULL,
     path_key TEXT NOT NULL,
     name_key TEXT NOT NULL,
     mtime INTEGER NOT NULL,
     size INTEGER NOT NULL,
     hash TEXT NOT NULL
   )`,
  `CREATE INDEX notes_path_key ON notes (path_key)`,
  `CREATE INDEX notes_name_key ON notes (name_key)`,
  `CREATE TABLE headings (
     note_id INTEGER NOT NULL,
     level INTEGER NOT NULL,
     text TEXT NOT NULL,
     pos INTEGER NOT NULL
   )`,
  `CREATE INDEX headings_note ON headings (note_id)`,
  `CREATE TABLE aliases (
     note_id INTEGER NOT NULL,
     alias TEXT NOT NULL,
     alias_key TEXT NOT NULL
   )`,
  `CREATE INDEX aliases_note ON aliases (note_id)`,
  `CREATE INDEX aliases_key ON aliases (alias_key)`,
  `CREATE TABLE links (
     source_id INTEGER NOT NULL,
     kind TEXT NOT NULL,
     target_raw TEXT NOT NULL,
     target_path TEXT,
     target_name TEXT,
     target_id INTEGER,
     alias TEXT,
     fragment TEXT,
     pos_start INTEGER NOT NULL,
     pos_end INTEGER NOT NULL
   )`,
  `CREATE INDEX links_source ON links (source_id)`,
  `CREATE INDEX links_target_path ON links (target_path)`,
  `CREATE INDEX links_target_name ON links (target_name)`,
  `CREATE INDEX links_target ON links (target_id)`,
];

/**
 * The id of the note that a link with these keys resolves to, or `NULL`:
 * exact path, then file name, then alias, the shortest path first
 * (ARCHITECTURE.md, section 4.4). Paths that differ only in case share a
 * key; the order of the paths decides between them.
 */
function resolvedId(pathKey: string, nameKey: string): string {
  return `COALESCE(
    (SELECT id FROM notes WHERE path_key = ${pathKey}
     ORDER BY path LIMIT 1),
    (SELECT id FROM notes WHERE name_key = ${nameKey}
     ORDER BY length(path), path LIMIT 1),
    (SELECT n.id FROM aliases a JOIN notes n ON n.id = a.note_id
     WHERE a.alias_key = ${nameKey}
     ORDER BY length(n.path), n.path LIMIT 1)
  )`;
}

/** Sets `target_id` of the links it is run on from their keys. */
const RELINK = `UPDATE links
  SET target_id = ${resolvedId("links.target_path", "links.target_name")}`;

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

  /**
   * Forgets notes and every row that belongs to them. Links to them from
   * other notes resolve again: to another note of the same name, or to
   * none.
   */
  async removeNotes(paths: readonly NotePath[]): Promise<void> {
    for (const chunk of chunks([...new Set(paths)], PATHS_PER_QUERY)) {
      const aliases = await this.aliasKeysOf(chunk);
      await this.deleteRowsOf(chunk);
      await this.db.execute(
        `DELETE FROM notes WHERE path IN (${marks(chunk.length)})`,
        chunk,
      );
      await this.relinkTargets(chunk, aliases);
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

  /**
   * The links of a note, in order, with the notes they resolve to. Empty
   * if it is not indexed.
   */
  async outgoingLinks(path: NotePath): Promise<OutgoingLink[]> {
    return this.db.select<OutgoingLink>(
      `SELECT l.kind, l.target_raw AS target, l.alias, l.fragment,
              l.pos_start AS start, l.pos_end AS "end", t.path AS resolved
       FROM links l JOIN notes n ON n.id = l.source_id
       LEFT JOIN notes t ON t.id = l.target_id
       WHERE n.path = ? ORDER BY l.pos_start`,
      [path],
    );
  }

  /**
   * The note that a link written in `source` points to, or `null`: for a
   * link that is not indexed yet, such as one being typed or clicked.
   */
  async resolve(
    source: NotePath,
    link: Pick<OutgoingLink, "kind" | "target">,
  ): Promise<NotePath | null> {
    const keys = linkKeys(source, link);
    const [row] = await this.db.select<{ path: string }>(
      `SELECT path FROM notes WHERE id = ${resolvedId("?", "?")}`,
      [keys.path, keys.name, keys.name],
    );
    return row?.path ?? null;
  }

  close(): Promise<void> {
    return this.db.close();
  }

  private async replaceChunk(entries: readonly IndexEntry[]): Promise<void> {
    const paths = entries.map((entry) => entry.note.path);
    // Links that matched an alias the note no longer has resolve again.
    const oldAliases = await this.aliasKeysOf(paths);
    await this.deleteRowsOf(paths);

    // An upsert, not delete and insert: the note keeps its id.
    await insertRows(
      this.db,
      "notes (path, title, path_key, name_key, mtime, size, hash)",
      entries.map(({ note, stamp }) => {
        const keys = noteKeys(note.path);
        return [
          note.path,
          note.title,
          keys.path,
          keys.name,
          stamp.mtime,
          stamp.size,
          stamp.hash,
        ];
      }),
      `ON CONFLICT (path) DO UPDATE SET title = excluded.title,
         path_key = excluded.path_key, name_key = excluded.name_key,
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
      "aliases (note_id, alias, alias_key)",
      entries.flatMap(({ note }) =>
        note.aliases.map((alias) => [idOf(note.path), alias, matchKey(alias)]),
      ),
    );
    await insertRows(
      this.db,
      `links (source_id, kind, target_raw, target_path, target_name,
              alias, fragment, pos_start, pos_end)`,
      entries.flatMap(({ note }) =>
        note.links.map((l) => {
          const keys = linkKeys(note.path, l);
          return [
            idOf(note.path),
            l.kind,
            l.target,
            keys.path,
            keys.name,
            l.alias,
            l.fragment,
            l.start,
            l.end,
          ];
        }),
      ),
    );

    // The links of these notes, and the links elsewhere that a new note,
    // or a new alias, may take over.
    await this.relink("source_id", [...ids.values()]);
    const newAliases = entries.flatMap(({ note }) =>
      note.aliases.map(matchKey),
    );
    await this.relinkTargets(paths, [...oldAliases, ...newAliases]);
  }

  /**
   * Resolves again the links that could point to notes at `paths`, or to
   * notes with the aliases `aliasKeys`: they are the only ones whose
   * target may change when those notes come or go.
   */
  private async relinkTargets(
    paths: readonly NotePath[],
    aliasKeys: readonly string[],
  ): Promise<void> {
    const keys = paths.map(noteKeys);
    await this.relink(
      "target_path",
      keys.map((k) => k.path),
    );
    await this.relink("target_name", [
      ...keys.map((k) => k.name),
      ...aliasKeys,
    ]);
  }

  private async relink(
    column: "source_id" | "target_path" | "target_name",
    values: readonly SqlValue[],
  ): Promise<void> {
    for (const chunk of chunks([...new Set(values)], PATHS_PER_QUERY)) {
      await this.db.execute(
        `${RELINK} WHERE ${column} IN (${marks(chunk.length)})`,
        chunk,
      );
    }
  }

  /** The alias keys of notes, as the index has them. */
  private async aliasKeysOf(paths: readonly NotePath[]): Promise<string[]> {
    const rows = await this.db.select<{ alias_key: string }>(
      `SELECT a.alias_key FROM aliases a JOIN notes n ON n.id = a.note_id
       WHERE n.path IN (${marks(paths.length)})`,
      paths,
    );
    return rows.map((row) => row.alias_key);
  }

  /** Deletes the rows that belong to notes, not the notes themselves. */
  private async deleteRowsOf(paths: readonly NotePath[]): Promise<void> {
    const ofNotes = `(SELECT id FROM notes WHERE path IN (${marks(paths.length)}))`;
    await this.db.execute(
      `DELETE FROM headings WHERE note_id IN ${ofNotes}`,
      paths,
    );
    await this.db.execute(
      `DELETE FROM aliases WHERE note_id IN ${ofNotes}`,
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
