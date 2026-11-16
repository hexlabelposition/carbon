import type {
  Platform,
  SqlDatabase,
  SqlStatement,
  SqlValue,
} from "../platform";
import { linkKeys, linkPath, matchKey, noteKeys } from "../links/resolve";
import { MATCH_END, MATCH_START, readMarks } from "../search/marks";
import type { FullTextQuery } from "../search/query";
import type {
  Backlink,
  Heading,
  NoteAlias,
  NoteMetadata,
  NotePath,
  OutgoingLink,
  ParsedNote,
  SearchHit,
  TagCount,
  UnresolvedTarget,
} from "../types";
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
export const SCHEMA_VERSION = 7;

/**
 * Notes, their headings, aliases, tags, properties and links. A link
 * keeps its target as written, the keys it is matched by
 * (`links/resolve.ts`), and the note it resolves to: `target_id` is
 * `NULL` while that note does not exist. A tag and an alias keep their
 * spelling and a key that ignores case; a property keeps its value as
 * JSON. The rows of a note are in the order the parser gave them.
 * `notes_fts` holds the title and the plain text of every note for
 * full-text search, under the row id of the note.
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
  `CREATE TABLE tags (
     note_id INTEGER NOT NULL,
     tag TEXT NOT NULL,
     tag_key TEXT NOT NULL
   )`,
  `CREATE INDEX tags_note ON tags (note_id)`,
  `CREATE INDEX tags_key ON tags (tag_key)`,
  // Each tag of a note and every tag it is nested in, once per note:
  // "a/b/c" gives "a", "a/b" and "a/b/c". Written with the note, so
  // counting the notes of a tag and its nested ones is a plain GROUP BY.
  `CREATE TABLE tag_parts (
     note_id INTEGER NOT NULL,
     tag TEXT NOT NULL,
     tag_key TEXT NOT NULL
   )`,
  `CREATE INDEX tag_parts_note ON tag_parts (note_id)`,
  `CREATE INDEX tag_parts_key ON tag_parts (tag_key)`,
  `CREATE TABLE properties (
     note_id INTEGER NOT NULL,
     key TEXT NOT NULL,
     value TEXT NOT NULL
   )`,
  `CREATE INDEX properties_note ON properties (note_id)`,
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
     pos_end INTEGER NOT NULL,
     snippet TEXT NOT NULL
   )`,
  `CREATE INDEX links_source ON links (source_id)`,
  `CREATE INDEX links_target_path ON links (target_path)`,
  `CREATE INDEX links_target_name ON links (target_name)`,
  `CREATE INDEX links_target ON links (target_id)`,
  // The text is stored here only: the index keeps no other copy of it.
  // `unicode61` folds case in every script and, with `remove_diacritics
  // 2`, the diacritics of Latin letters: "cafe" finds "Café". It keeps
  // the marks of other scripts, so "й" is not "и". Look-alike letters it
  // keeps apart, such as "е" and "ё", are searched for in every spelling
  // (`search/fold.ts`). Text without spaces between words, such as
  // Japanese, is one word to it: only its start is found.
  `CREATE VIRTUAL TABLE notes_fts USING fts5 (
     title, body, tokenize = 'unicode61 remove_diacritics 2'
   )`,
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

/** How much more a word in the title counts than one in the body. */
const TITLE_WEIGHT = 10;
/** Words in the snippet of a search hit; FTS5 takes at most 64. */
const SNIPPET_WORDS = 16;
/** Characters of the body shown for a hit found by its path alone. */
const PLAIN_SNIPPET_LENGTH = 120;

/**
 * The index of one vault, in SQLite (ADR-009). The database is a cache in
 * the app cache directory, one file per vault: the files of the vault are
 * the truth, and the startup scan repairs whatever the index missed.
 *
 * Writing notes takes two transactions (`SqlDatabase.batch`): the notes,
 * then their rows. A crash in between leaves notes without their rows
 * until the next scan, which is acceptable for a cache (ARCHITECTURE.md,
 * section 7).
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
      await this.db.batch([
        ...deleteRowsOf(chunk),
        {
          sql: `DELETE FROM notes WHERE path IN (${marks(chunk.length)})`,
          params: chunk,
        },
        ...relinkTargets(chunk, aliases),
      ]);
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
   * The tags, aliases and properties of a note, as the parser gave them,
   * except a property value JSON cannot hold, which is `null`. `null` if
   * the note is not indexed.
   */
  async metadata(path: NotePath): Promise<NoteMetadata | null> {
    const [note] = await this.db.select<{ id: number }>(
      "SELECT id FROM notes WHERE path = ?",
      [path],
    );
    if (note === undefined) return null;
    const tags = await this.db.select<{ tag: string }>(
      "SELECT tag FROM tags WHERE note_id = ? ORDER BY rowid",
      [note.id],
    );
    const aliases = await this.db.select<{ alias: string }>(
      "SELECT alias FROM aliases WHERE note_id = ? ORDER BY rowid",
      [note.id],
    );
    const properties = await this.db.select<{ key: string; value: string }>(
      "SELECT key, value FROM properties WHERE note_id = ? ORDER BY rowid",
      [note.id],
    );
    const values: Record<string, unknown> = {};
    for (const { key, value } of properties) {
      // Not `values[key] =`: a key named "__proto__" stays a key.
      Object.defineProperty(values, key, {
        value: JSON.parse(value) as unknown,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return {
      tags: tags.map((row) => row.tag),
      aliases: aliases.map((row) => row.alias),
      properties: values,
    };
  }

  /**
   * Every alias of every note, by the path of the note, then in the order
   * its frontmatter gives them.
   */
  async aliases(): Promise<NoteAlias[]> {
    return this.db.select<NoteAlias>(
      `SELECT n.path, a.alias FROM aliases a JOIN notes n ON n.id = a.note_id
       ORDER BY n.path, a.rowid`,
    );
  }

  /**
   * Every tag of the vault with the number of notes that have it or a tag
   * nested in it, as `notesWithTag` finds them, ordered by the tag,
   * ignoring case. A tag that only has tags nested in it is there too:
   * `a/b` alone gives `a` and `a/b`. Tags that differ only in case are
   * one, spelled as in the note with the first path.
   */
  async tags(): Promise<TagCount[]> {
    // The bare `tag` comes from the row of `MIN(n.path)`, as SQLite does
    // for a query with one `MIN`; a note has each key once.
    const rows = await this.db.select<TagCount & { first: string }>(
      `SELECT p.tag, COUNT(*) AS count, MIN(n.path) AS first
       FROM tag_parts p JOIN notes n ON n.id = p.note_id
       GROUP BY p.tag_key ORDER BY p.tag_key`,
    );
    return rows.map(({ tag, count }) => ({ tag, count }));
  }

  /**
   * The notes with the tag `tag`, or a tag nested in it, by path: `a`
   * finds the notes with `a` and with `a/b`. Case is ignored, and so is a
   * "#" in front.
   */
  async notesWithTag(tag: string): Promise<NotePath[]> {
    const key = matchKey(tag.replace(/^#/, ""));
    const rows = await this.db.select<{ path: string }>(
      `SELECT n.path FROM tag_parts p JOIN notes n ON n.id = p.note_id
       WHERE p.tag_key = ? ORDER BY n.path`,
      [key],
    );
    return rows.map((row) => row.path);
  }

  /**
   * The links of a note, in order, with the notes they resolve to. Empty
   * if it is not indexed.
   */
  async outgoingLinks(path: NotePath): Promise<OutgoingLink[]> {
    return this.db.select<OutgoingLink>(
      `SELECT l.kind, l.target_raw AS target, l.alias, l.fragment,
              l.pos_start AS start, l.pos_end AS "end", l.snippet,
              t.path AS resolved
       FROM links l JOIN notes n ON n.id = l.source_id
       LEFT JOIN notes t ON t.id = l.target_id
       WHERE n.path = ? ORDER BY l.pos_start`,
      [path],
    );
  }

  /**
   * The links in other notes that resolve to the note at `path`, by the
   * path of their note, then in the order they are written. A note that
   * links to itself is not its own backlink. Empty if it is not indexed.
   */
  async backlinks(path: NotePath): Promise<Backlink[]> {
    return this.db.select<Backlink>(
      `SELECT s.path AS source, s.title AS sourceTitle, l.snippet,
              l.pos_start AS start, l.pos_end AS "end"
       FROM notes t
       JOIN links l ON l.target_id = t.id AND l.source_id <> t.id
       JOIN notes s ON s.id = l.source_id
       WHERE t.path = ? ORDER BY s.path, l.pos_start`,
      [path],
    );
  }

  /**
   * Every link that finds no note, grouped by the note it is missing:
   * links that spell one path differently, or name one note from
   * different folders, are one group. Ordered by that path, ignoring case.
   * Links that no note could ever resolve, such as one above the vault
   * root, are left out.
   */
  async unresolved(): Promise<UnresolvedTarget[]> {
    const rows = await this.db.select<
      Backlink & Pick<OutgoingLink, "kind" | "target"> & { key: string }
    >(
      `SELECT l.target_path AS key, l.kind, l.target_raw AS target,
              s.path AS source, s.title AS sourceTitle, l.snippet,
              l.pos_start AS start, l.pos_end AS "end"
       FROM links l JOIN notes s ON s.id = l.source_id
       WHERE l.target_id IS NULL AND l.target_path IS NOT NULL
       ORDER BY l.target_path, s.path, l.pos_start`,
    );
    const groups = new Map<string, UnresolvedTarget>();
    for (const { key, kind, target, ...link } of rows) {
      let group = groups.get(key);
      if (group === undefined) {
        // Not null: the link has a path key.
        const path = linkPath(link.source, { kind, target }) ?? key;
        group = { path, links: [] };
        groups.set(key, group);
      }
      group.links.push(link);
    }
    return [...groups.values()];
  }

  /**
   * The notes with links that resolve to any of the notes at `targets`,
   * themselves included: the notes whose links a rename may rewrite.
   */
  async linkSources(targets: readonly NotePath[]): Promise<NotePath[]> {
    const sources = new Set<NotePath>();
    for (const chunk of chunks([...new Set(targets)], PATHS_PER_QUERY)) {
      const rows = await this.db.select<{ path: string }>(
        `SELECT DISTINCT s.path FROM notes t
         JOIN links l ON l.target_id = t.id
         JOIN notes s ON s.id = l.source_id
         WHERE t.path IN (${marks(chunk.length)})`,
        chunk,
      );
      for (const { path } of rows) sources.add(path);
    }
    return [...sources].sort();
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

  /**
   * The notes that match `query`, at most `limit` of them, the best
   * first: the ones whose title and body match its FTS5 query, ranked by
   * BM25 with a word in the title worth `TITLE_WEIGHT` words in the body,
   * whose path keys have each of its `paths`, and that have a tag that
   * starts with each of its `tags`. With filters alone, the notes in path
   * order, each with the start of its body. Rejects on a query that is
   * not valid FTS5.
   */
  async search(query: FullTextQuery, limit: number): Promise<SearchHit[]> {
    const where = [
      ...query.paths.map(() => "AND instr(n.path_key, ?) > 0"),
      // Not LIKE: "_" is fine in a tag.
      ...query.tags.map(
        () => `AND EXISTS (SELECT 1 FROM tags t WHERE t.note_id = n.id
           AND substr(t.tag_key, 1, length(?)) = ?)`,
      ),
    ].join(" ");
    const filters = [
      ...query.paths,
      ...query.tags.flatMap((tag) => [tag, tag]),
    ];
    if (query.match === null) {
      const rows = await this.db.select<{
        path: string;
        title: string;
        body: string;
      }>(
        `SELECT n.path, n.title, substr(f.body, 1, ${PLAIN_SNIPPET_LENGTH + 1}) AS body
         FROM notes n JOIN notes_fts f ON f.rowid = n.id
         WHERE 1 ${where} ORDER BY n.path LIMIT ?`,
        [...filters, limit],
      );
      return rows.map((row) => {
        const body = readMarks(row.body, true).text;
        return {
          path: row.path,
          title: row.title,
          titleMatches: [],
          snippet:
            body.length > PLAIN_SNIPPET_LENGTH
              ? `${body.slice(0, PLAIN_SNIPPET_LENGTH).trimEnd()}…`
              : body,
          snippetMatches: [],
          score: 0,
        };
      });
    }

    const rows = await this.db.select<{
      path: string;
      title: string;
      snippet: string;
      rank: number;
    }>(
      `SELECT n.path, highlight(notes_fts, 0, ?, ?) AS title,
              snippet(notes_fts, 1, ?, ?, '…', ${SNIPPET_WORDS}) AS snippet,
              bm25(notes_fts, ${TITLE_WEIGHT}, 1) AS rank
       FROM notes_fts JOIN notes n ON n.id = notes_fts.rowid
       WHERE notes_fts MATCH ? ${where} ORDER BY rank, n.path LIMIT ?`,
      [
        MATCH_START,
        MATCH_END,
        MATCH_START,
        MATCH_END,
        query.match,
        ...filters,
        limit,
      ],
    );
    return rows.map((row) => {
      const title = readMarks(row.title);
      const snippet = readMarks(row.snippet, true);
      return {
        path: row.path,
        title: title.text,
        titleMatches: title.matches,
        snippet: snippet.text,
        snippetMatches: snippet.matches,
        // BM25 in FTS5 is lower for a better match.
        score: -row.rank,
      };
    });
  }

  close(): Promise<void> {
    return this.db.close();
  }

  /**
   * Replaces the rows of some notes in two transactions (ADR-029): the
   * notes themselves first, as their child rows need their ids, then
   * everything that hangs on them. A crash between the two leaves notes
   * without their rows, which the next scan repairs: the index is a cache.
   */
  private async replaceChunk(entries: readonly IndexEntry[]): Promise<void> {
    const paths = entries.map((entry) => entry.note.path);
    // Links that matched an alias the note no longer has resolve again.
    const oldAliases = await this.aliasKeysOf(paths);

    await this.db.batch([
      ...deleteRowsOf(paths),
      // An upsert, not delete and insert: the note keeps its id.
      ...insertRows(
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
      ),
    ]);

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

    const newAliases = entries.flatMap(({ note }) =>
      note.aliases.map(matchKey),
    );
    await this.db.batch([
      ...insertRows(
        "headings (note_id, level, text, pos)",
        entries.flatMap(({ note }) =>
          note.headings.map((h) => [idOf(note.path), h.level, h.text, h.pos]),
        ),
      ),
      ...insertRows(
        "notes_fts (rowid, title, body)",
        entries.map(({ note }) => [
          idOf(note.path),
          note.title,
          note.plainText,
        ]),
      ),
      ...insertRows(
        "aliases (note_id, alias, alias_key)",
        entries.flatMap(({ note }) =>
          note.aliases.map((alias) => [
            idOf(note.path),
            alias,
            matchKey(alias),
          ]),
        ),
      ),
      ...insertRows(
        "tags (note_id, tag, tag_key)",
        entries.flatMap(({ note }) =>
          note.tags.map((tag) => [idOf(note.path), tag, matchKey(tag)]),
        ),
      ),
      ...insertRows(
        "tag_parts (note_id, tag, tag_key)",
        entries.flatMap(({ note }) =>
          tagParts(note.tags).map(([tag, key]) => [idOf(note.path), tag, key]),
        ),
      ),
      ...insertRows(
        "properties (note_id, key, value)",
        entries.flatMap(({ note }) =>
          Object.entries(note.properties).map(([key, value]) => [
            idOf(note.path),
            key,
            // `?? null`: a value JSON has no form for, such as a function,
            // is stored as null rather than lost with its key.
            JSON.stringify(value) ?? "null",
          ]),
        ),
      ),
      ...insertRows(
        `links (source_id, kind, target_raw, target_path, target_name,
                alias, fragment, pos_start, pos_end, snippet)`,
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
              l.snippet,
            ];
          }),
        ),
      ),
      // The links of these notes, and the links elsewhere that a new note,
      // or a new alias, may take over.
      ...relink("source_id", [...ids.values()]),
      ...relinkTargets(paths, [...oldAliases, ...newAliases]),
    ]);
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

/**
 * Inserts rows, `ROWS_PER_INSERT` to a statement: the statements to put
 * in a batch. None for no rows.
 */
function insertRows(
  into: string,
  rows: readonly SqlValue[][],
  suffix = "",
): SqlStatement[] {
  return chunks(rows, ROWS_PER_INSERT).map((chunk) => {
    const tuple = `(${marks(chunk[0].length)})`;
    return {
      sql: `INSERT INTO ${into} VALUES ${Array(chunk.length).fill(tuple).join(", ")} ${suffix}`,
      params: chunk.flat(),
    };
  });
}

/** Deletes the rows that belong to notes, not the notes themselves. */
function deleteRowsOf(paths: readonly NotePath[]): SqlStatement[] {
  const ofNotes = `(SELECT id FROM notes WHERE path IN (${marks(paths.length)}))`;
  return [
    `DELETE FROM headings WHERE note_id IN ${ofNotes}`,
    `DELETE FROM aliases WHERE note_id IN ${ofNotes}`,
    `DELETE FROM tags WHERE note_id IN ${ofNotes}`,
    `DELETE FROM tag_parts WHERE note_id IN ${ofNotes}`,
    `DELETE FROM properties WHERE note_id IN ${ofNotes}`,
    `DELETE FROM links WHERE source_id IN ${ofNotes}`,
    `DELETE FROM notes_fts WHERE rowid IN ${ofNotes}`,
  ].map((sql) => ({ sql, params: paths }));
}

/**
 * Resolves again the links that could point to notes at `paths`, or to
 * notes with the aliases `aliasKeys`: they are the only ones whose target
 * may change when those notes come or go.
 */
function relinkTargets(
  paths: readonly NotePath[],
  aliasKeys: readonly string[],
): SqlStatement[] {
  const keys = paths.map(noteKeys);
  return [
    ...relink(
      "target_path",
      keys.map((k) => k.path),
    ),
    ...relink("target_name", [...keys.map((k) => k.name), ...aliasKeys]),
  ];
}

/** Resolves again the links whose `column` is one of `values`. */
function relink(
  column: "source_id" | "target_path" | "target_name",
  values: readonly SqlValue[],
): SqlStatement[] {
  return chunks([...new Set(values)], PATHS_PER_QUERY).map((chunk) => ({
    sql: `${RELINK} WHERE ${column} IN (${marks(chunk.length)})`,
    params: chunk,
  }));
}

/**
 * The tags of a note and every tag they are nested in, each key once, as
 * `[tag, key]`: spelled as the first tag that has it.
 */
function tagParts(tags: readonly string[]): [string, string][] {
  const parts = new Map<string, string>();
  for (const tag of tags) {
    const pieces = tag.split("/");
    for (let i = 1; i <= pieces.length; i++) {
      const part = pieces.slice(0, i).join("/");
      const key = matchKey(part);
      if (!parts.has(key)) parts.set(key, part);
    }
  }
  return [...parts].map(([key, tag]) => [tag, key]);
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
