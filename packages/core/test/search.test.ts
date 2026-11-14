import { describe, expect, test } from "bun:test";
import {
  IndexStore,
  parseNote,
  Vault,
  type IndexEntry,
  type SearchHit,
} from "../src/index";
import { readMarks } from "../src/search/marks";
import { firstMatch } from "../src/search/locate";
import { fullTextQuery } from "../src/search/query";
import { Search } from "../src/search/search";
import { createMemoryPlatform } from "./fakes";

/** The text of each note made by `note`, as `vault.notes.read` has it. */
const texts = new Map<string, string>();

const note = (path: string, text = ""): IndexEntry => {
  texts.set(path, text);
  return {
    note: parseNote(path, text),
    stamp: { mtime: 1, size: text.length, hash: "h" },
  };
};

/** `vault.search` over an index of these notes. */
async function searchOver(...entries: IndexEntry[]) {
  const store = await IndexStore.open(createMemoryPlatform(), "/v");
  await store.replaceNotes(entries);
  return new Search({
    index: async () => store,
    read: async (path) => {
      const text = texts.get(path);
      if (text === undefined) throw new Error(`No note: ${path}`);
      return text;
    },
  });
}

const paths = (hits: SearchHit[]) => hits.map((hit) => hit.path);

/** The parts of `text` that `ranges` cover. */
const parts = (text: string, ranges: { start: number; end: number }[]) =>
  ranges.map((r) => text.slice(r.start, r.end));

describe("search", () => {
  describe("fullTextQuery", () => {
    test("asks for every word, or the start of it", () => {
      expect(fullTextQuery("green tea")).toBe('"green"* "tea"*');
    });

    test("never passes on FTS5 syntax", () => {
      expect(fullTextQuery('a OR "b" -c title:d NEAR(e) f*')).toBe(
        '"a"* "OR"* "b"* "c"* "title"* "d"* "NEAR"* "e"* "f"*',
      );
    });

    test("keeps letters of any script and their marks", () => {
      expect(fullTextQuery("Привіт, café 42")).toBe('"Привіт"* "café"* "42"*');
    });

    test("is null without a word", () => {
      expect(fullTextQuery("")).toBeNull();
      expect(fullTextQuery('  "*-:() ')).toBeNull();
    });
  });

  describe("readMarks", () => {
    test("takes the marks out and tells where they were", () => {
      expect(readMarks("a \u0002bc\u0003 d\u0002e\u0003")).toEqual({
        text: "a bc de",
        matches: [
          { start: 2, end: 4 },
          { start: 6, end: 7 },
        ],
      });
    });

    test("puts a text on one line when asked", () => {
      expect(readMarks("\n one\n\n\u0002two\u0003  three \n", true)).toEqual({
        text: "one two three",
        matches: [{ start: 4, end: 7 }],
      });
      expect(readMarks("a\nb").text).toBe("a\nb");
    });

    test("ignores marks without a pair", () => {
      expect(readMarks("a\u0003b\u0002c")).toEqual({
        text: "abc",
        matches: [],
      });
    });
  });

  describe("firstMatch", () => {
    test("finds the first word that starts with a word searched for", () => {
      const text = "Notes about trees. A tree grows.";
      expect(firstMatch(text, "tree")).toBe(text.indexOf("trees"));
      expect(firstMatch(text, "grow notes")).toBe(0);
    });

    test("ignores case, in any script", () => {
      expect(firstMatch("Мій Сад", "сад")).toBe(4);
      expect(firstMatch("A GARDEN", "garden")).toBe(2);
    });

    test("only at the start of a word", () => {
      expect(firstMatch("a subtree, a tree", "tree")).toBe(13);
      expect(firstMatch("subtree", "tree")).toBeNull();
    });

    test("skips the frontmatter", () => {
      const text = "---\ntags: tree\n---\nA tree";
      expect(firstMatch(text, "tree")).toBe(text.lastIndexOf("tree"));
    });

    test("is null without a match or a word", () => {
      expect(firstMatch("text", "other")).toBeNull();
      expect(firstMatch("text", " *- ")).toBeNull();
      expect(firstMatch("", "text")).toBeNull();
    });
  });

  describe("query", () => {
    test("finds notes with every word, in the title or the body", async () => {
      const search = await searchOver(
        note("Green tea.md", "Brew it short."),
        note("Coffee.md", "Green beans, roasted."),
        note("Tea.md", "Black and green."),
      );
      expect(paths(await search.query("green tea")).sort()).toEqual([
        "Green tea.md",
        "Tea.md",
      ]);
      expect(await search.query("green milk")).toEqual([]);
    });

    test("finds a word by its start, ignoring case", async () => {
      const search = await searchOver(note("a.md", "Searching NOTES"));
      expect(paths(await search.query("sea"))).toEqual(["a.md"]);
      expect(paths(await search.query("notes"))).toEqual(["a.md"]);
      expect(await search.query("arch")).toEqual([]);
    });

    test("puts a match in the title before one in the body", async () => {
      const search = await searchOver(
        note("Body.md", "Garden garden garden, all about the garden."),
        note("Garden.md", "Where things grow."),
      );
      const hits = await search.query("garden");
      expect(paths(hits)).toEqual(["Garden.md", "Body.md"]);
      expect(hits[0].score).toBeGreaterThan(hits[1].score);
    });

    test("ranks a note with more of the word above one with less", async () => {
      const search = await searchOver(
        note("a.md", "One mention of rust, then other things entirely."),
        note("b.md", "Rust, rust and rust."),
      );
      expect(paths(await search.query("rust"))).toEqual(["b.md", "a.md"]);
    });

    test("highlights the matches in the title and the snippet", async () => {
      const text = "# Plans\n\nThis year the garden gets **tomatoes**.";
      const search = await searchOver(note("Garden plans.md", text));
      const [hit] = await search.query("garden toma");

      expect(hit.title).toBe("Garden plans");
      expect(parts(hit.title, hit.titleMatches)).toEqual(["Garden"]);
      expect(hit.snippet).toBe("Plans This year the garden gets tomatoes.");
      expect(parts(hit.snippet, hit.snippetMatches)).toEqual([
        "garden",
        "tomatoes",
      ]);
    });

    test("cuts a long body short around the match", async () => {
      const filler = Array.from({ length: 100 }, (_, i) => `w${i}`).join(" ");
      const search = await searchOver(
        note("a.md", `${filler} needle ${filler}`),
      );
      const [hit] = await search.query("needle");

      expect(hit.snippet.startsWith("…")).toBe(true);
      expect(hit.snippet.endsWith("…")).toBe(true);
      expect(hit.snippet.split(" ").length).toBeLessThanOrEqual(16);
      expect(parts(hit.snippet, hit.snippetMatches)).toEqual(["needle"]);
    });

    test("shows the start of the body when only the title matches", async () => {
      const search = await searchOver(note("Recipes.md", "Soup.\n\nBread."));
      const [hit] = await search.query("recipes");
      expect(hit.snippet).toBe("Soup. Bread.");
      expect(hit.snippetMatches).toEqual([]);
    });

    test("takes what the user types as plain words", async () => {
      const search = await searchOver(
        note("a.md", 'He said "or" -- title: not NEAR'),
      );
      for (const text of ['"or"', "-- title:", "NOT near", "or*", "(near"]) {
        expect(paths(await search.query(text))).toEqual(["a.md"]);
      }
    });

    test("returns at most `limit` hits, the best ones", async () => {
      const search = await searchOver(
        note("a.md", "word"),
        note("Word.md", "word"),
        note("c.md", "word"),
      );
      expect(paths(await search.query("word", { limit: 1 }))).toEqual([
        "Word.md",
      ]);
      expect(await search.query("word")).toHaveLength(3);
    });

    test("finds nothing for text without words", async () => {
      const search = await searchOver(note("a.md", "text"));
      expect(await search.query("")).toEqual([]);
      expect(await search.query(" *:- ")).toEqual([]);
    });

    test("tells where to open a hit", async () => {
      const text = "# Intro\n\nSome words, then the needle.";
      const search = await searchOver(note("Needle.md", text), note("b.md"));
      expect(await search.locate("Needle.md", "needle")).toBe(
        text.indexOf("needle"),
      );
      expect(await search.locate("b.md", "needle")).toBeNull();
      await expect(search.locate("missing.md", "needle")).rejects.toThrow();
    });

    test("searches a whole vault opened as one", async () => {
      const root = "/v";
      const platform = createMemoryPlatform({
        [`${root}/Ideas.md`]: "Search the notes",
        [`${root}/dir/Other.md`]: "Nothing here",
      });
      const vault = await Vault.open(root, platform);
      await vault.indexed();

      expect(paths(await vault.search.query("search"))).toEqual(["Ideas.md"]);
      expect(paths(await vault.search.query("other"))).toEqual([
        "dir/Other.md",
      ]);
      vault.close();
    });
  });
});
