import { describe, expect, test } from "bun:test";
import {
  IndexStore,
  indexFileName,
  parseNote,
  SCHEMA_VERSION,
  type IndexEntry,
  type NoteStamp,
} from "../src/index";
import { createMemoryPlatform } from "./fakes";

const ROOT = "/home/me/vault";

const stamp = (mtime = 1, size = 10, hash = "h"): NoteStamp => ({
  mtime,
  size,
  hash,
});

/** A note as the indexer would hand it over. */
const entry = (path: string, text: string, at = stamp()): IndexEntry => ({
  note: parseNote(path, text),
  stamp: at,
});

async function openStore() {
  const platform = createMemoryPlatform();
  const store = await IndexStore.open(platform, ROOT);
  return { platform, store };
}

/** The notes whose full text matches an FTS5 query, by path. */
function fullText(
  platform: ReturnType<typeof createMemoryPlatform>,
  query: string,
): string[] | undefined {
  return platform.sql
    .raw(indexFileName(ROOT))
    ?.query<{ path: string }, [string]>(
      `SELECT n.path FROM notes_fts f JOIN notes n ON n.id = f.rowid
       WHERE notes_fts MATCH ? ORDER BY n.path`,
    )
    .all(query)
    .map((row) => row.path);
}

describe("IndexStore", () => {
  describe("open", () => {
    test("creates the index of a vault in a file of its own", async () => {
      const { platform, store } = await openStore();
      expect(store.created).toBe(true);
      expect(platform.sql.opened).toEqual([indexFileName(ROOT)]);
      expect(await store.stamps()).toEqual(new Map());
    });

    test("names the file by the vault, whatever the spelling of its path", () => {
      expect(indexFileName("C:\\notes\\")).toBe(indexFileName("C:/notes"));
      expect(indexFileName("/a")).not.toBe(indexFileName("/b"));
      expect(indexFileName("/a")).toMatch(/^index-[0-9a-f]{16}\.db$/);
    });

    test("keeps what was indexed between opens", async () => {
      const { platform, store } = await openStore();
      await store.replaceNotes([entry("a.md", "# A", stamp(5, 3, "x"))]);
      await store.close();

      const again = await IndexStore.open(platform, ROOT);
      expect(again.created).toBe(false);
      expect(await again.stamps()).toEqual(
        new Map([["a.md", stamp(5, 3, "x")]]),
      );
    });

    test("rebuilds an index of another version", async () => {
      const { platform, store } = await openStore();
      await store.replaceNotes([entry("a.md", "# A")]);
      await store.close();
      const raw = platform.sql.raw(indexFileName(ROOT));
      raw?.run(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
      // What an older version may have left: a table of its own, virtual.
      raw?.run("CREATE VIRTUAL TABLE old_fts USING fts5(body)");

      const again = await IndexStore.open(platform, ROOT);
      expect(again.created).toBe(true);
      expect(await again.stamps()).toEqual(new Map());
      const tables = raw
        ?.query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        )
        .all()
        .map((row) => row.name);
      expect(tables).toEqual([
        "aliases",
        "headings",
        "links",
        "notes",
        "notes_fts",
        "notes_fts_config",
        "notes_fts_content",
        "notes_fts_data",
        "notes_fts_docsize",
        "notes_fts_idx",
      ]);
    });

    test("closes the database when it cannot be opened", async () => {
      const platform = createMemoryPlatform();
      let closed = false;
      platform.sql.open = async () => ({
        execute: () => Promise.reject(new Error("disk full")),
        select: (sql: string) =>
          Promise.resolve(
            (sql === "PRAGMA user_version"
              ? [{ user_version: 0 }]
              : []) as never[],
          ),
        close: async () => {
          closed = true;
        },
      });
      await expect(IndexStore.open(platform, ROOT)).rejects.toThrow(
        "disk full",
      );
      expect(closed).toBe(true);
    });
  });

  describe("replaceNotes", () => {
    test("stores headings and links as the parser found them", async () => {
      const { store } = await openStore();
      const text = "# Title\n\nSee [[Other#Part|it]] and [b](b.md).\n\n## Two";
      await store.replaceNotes([entry("dir/a.md", text)]);
      const parsed = parseNote("dir/a.md", text);

      expect(await store.headings("dir/a.md")).toEqual(parsed.headings);
      expect(await store.outgoingLinks("dir/a.md")).toEqual(
        parsed.links.map((link) => ({ ...link, resolved: null })),
      );
    });

    test("replaces every row of a note indexed again", async () => {
      const { store } = await openStore();
      await store.replaceNotes([entry("a.md", "# Old\n[[X]] [[Y]]")]);
      await store.replaceNotes([entry("a.md", "# New\n[[Z]]", stamp(2))]);

      expect((await store.headings("a.md")).map((h) => h.text)).toEqual([
        "New",
      ]);
      expect((await store.outgoingLinks("a.md")).map((l) => l.target)).toEqual([
        "Z",
      ]);
      expect((await store.stamps()).get("a.md")).toEqual(stamp(2));
    });

    test("keeps the row id of a note indexed again", async () => {
      const { platform, store } = await openStore();
      await store.replaceNotes([entry("a.md", "one"), entry("b.md", "two")]);
      const idOf = (path: string) =>
        platform.sql
          .raw(indexFileName(ROOT))
          ?.query<{ id: number }, [string]>(
            "SELECT id FROM notes WHERE path = ?",
          )
          .get(path)?.id;
      const before = idOf("a.md");
      await store.replaceNotes([entry("a.md", "changed", stamp(2))]);
      expect(idOf("a.md")).toBe(before);
    });

    test("leaves the other notes alone", async () => {
      const { store } = await openStore();
      await store.replaceNotes([
        entry("a.md", "[[B]]"),
        entry("b.md", "[[A]]"),
      ]);
      await store.replaceNotes([entry("a.md", "no links")]);
      expect(await store.outgoingLinks("b.md")).toHaveLength(1);
    });

    test("takes the last entry of a path given twice", async () => {
      const { store } = await openStore();
      await store.replaceNotes([
        entry("a.md", "[[First]]", stamp(1)),
        entry("a.md", "[[Second]]", stamp(2)),
      ]);
      expect((await store.outgoingLinks("a.md")).map((l) => l.target)).toEqual([
        "Second",
      ]);
      expect((await store.stamps()).get("a.md")).toEqual(stamp(2));
    });

    test("writes a whole vault in batches", async () => {
      const { store } = await openStore();
      // More notes than one query takes, more links than one insert.
      const entries = Array.from({ length: 1200 }, (_, i) =>
        entry(`n${i}.md`, `# Note ${i}\n[[n${i + 1}]] [[n${i + 2}]]`),
      );
      await store.replaceNotes(entries);

      expect((await store.stamps()).size).toBe(1200);
      expect(await store.outgoingLinks("n1199.md")).toHaveLength(2);
      expect((await store.headings("n700.md"))[0].text).toBe("Note 700");
    });

    test("keeps text exactly, quotes and all", async () => {
      const { store } = await openStore();
      const text =
        "# It's \"quoted\" -- ; DROP TABLE notes\n[[O'Brien|Ünïcødé]]";
      await store.replaceNotes([entry("o'brien.md", text)]);
      expect((await store.headings("o'brien.md"))[0].text).toBe(
        'It\'s "quoted" -- ; DROP TABLE notes',
      );
      expect((await store.outgoingLinks("o'brien.md"))[0]).toMatchObject({
        target: "O'Brien",
        alias: "Ünïcødé",
      });
    });
  });

  describe("full text", () => {
    test("finds a note by a word of its title or its body", async () => {
      const { platform, store } = await openStore();
      await store.replaceNotes([
        entry("dir/Garden.md", "# Plans\n\nTomatoes and **basil**."),
        entry("Kitchen.md", "Basil goes in the [[Garden|sauce]]."),
      ]);

      expect(fullText(platform, "garden")).toEqual(["dir/Garden.md"]);
      expect(fullText(platform, "plans")).toEqual(["dir/Garden.md"]);
      expect(fullText(platform, "basil")).toEqual([
        "Kitchen.md",
        "dir/Garden.md",
      ]);
      expect(fullText(platform, "title: kitchen")).toEqual(["Kitchen.md"]);
    });

    test("leaves Markdown syntax and frontmatter out", async () => {
      const { platform, store } = await openStore();
      await store.replaceNotes([
        entry("a.md", "---\nsecret: yes\n---\n[text](https://example.com)"),
      ]);

      expect(fullText(platform, "text")).toEqual(["a.md"]);
      expect(fullText(platform, "secret")).toEqual([]);
      expect(fullText(platform, "example")).toEqual([]);
    });

    test("follows a note indexed again", async () => {
      const { platform, store } = await openStore();
      await store.replaceNotes([entry("a.md", "old words")]);
      await store.replaceNotes([entry("a.md", "new words", stamp(2))]);

      expect(fullText(platform, "old")).toEqual([]);
      expect(fullText(platform, "new")).toEqual(["a.md"]);
      expect(fullText(platform, "words")).toEqual(["a.md"]);
    });

    test("forgets a removed note", async () => {
      const { platform, store } = await openStore();
      await store.replaceNotes([
        entry("a.md", "shared word"),
        entry("b.md", "shared word"),
      ]);
      await store.removeNotes(["a.md"]);

      expect(fullText(platform, "shared")).toEqual(["b.md"]);
    });

    test("indexes a whole vault in batches", async () => {
      const { platform, store } = await openStore();
      const entries = Array.from({ length: 1200 }, (_, i) =>
        entry(`n${i}.md`, `common word${i}`),
      );
      await store.replaceNotes(entries);

      expect(fullText(platform, "common")).toHaveLength(1200);
      expect(fullText(platform, "word1199")).toEqual(["n1199.md"]);
    });
  });

  describe("removeNotes", () => {
    test("forgets the notes and their rows", async () => {
      const { store } = await openStore();
      await store.replaceNotes([
        entry("a.md", "# A\n[[B]]"),
        entry("b.md", "# B\n[[A]]"),
      ]);
      await store.removeNotes(["a.md", "missing.md"]);

      expect([...(await store.stamps()).keys()]).toEqual(["b.md"]);
      expect(await store.headings("a.md")).toEqual([]);
      expect(await store.outgoingLinks("a.md")).toEqual([]);
      expect(await store.outgoingLinks("b.md")).toHaveLength(1);
    });

    test("does nothing for an empty list", async () => {
      const { store } = await openStore();
      await store.replaceNotes([]);
      await store.removeNotes([]);
      expect((await store.stamps()).size).toBe(0);
    });
  });
});
