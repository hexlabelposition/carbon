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
import { fold, spellings } from "../src/search/fold";
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
    tree: async () => [],
  });
}

const paths = (hits: SearchHit[]) => hits.map((hit) => hit.path);

/** The parts of `text` that `ranges` cover. */
const parts = (text: string, ranges: { start: number; end: number }[]) =>
  ranges.map((r) => text.slice(r.start, r.end));

describe("search", () => {
  describe("fullTextQuery", () => {
    test("asks for every word, or the start of it", () => {
      expect(fullTextQuery("Green tea")).toBe('"green"* AND "tea"*');
    });

    test("never passes on FTS5 syntax", () => {
      expect(fullTextQuery('a OR "b" -c :d NEAR(e) f*')).toBe(
        '"a"* AND "or"* AND "b"* AND "c"* AND "d"* AND "near"* AND "e"* AND "f"*',
      );
    });

    test("keeps letters of any script and their marks", () => {
      expect(fullTextQuery("Привіт, café 42")).toBe(
        '"привіт"* AND "café"* AND "42"*',
      );
    });

    test("asks for every spelling of look-alike letters", () => {
      expect(fullTextQuery("Ёлка tea")).toBe('("елка"* OR "ёлка"*) AND "tea"*');
    });

    test("is null without a word", () => {
      expect(fullTextQuery("")).toBeNull();
      expect(fullTextQuery('  "*-:() ')).toBeNull();
    });
  });

  describe("spellings", () => {
    test("is the word in lower case without look-alike letters", () => {
      expect(spellings("Привіт")).toEqual(["привіт"]);
    });

    test("tries each look-alike letter both ways", () => {
      expect(spellings("ежё")).toEqual(["еже", "ежё", "ёже", "ёжё"]);
      expect(spellings("Łódź").sort()).toEqual(["lódź", "łódź"]);
    });

    test("keeps to three spellings for a word with many", () => {
      expect(spellings("lllll")).toEqual(["lllll", "łłłłł"]);
      expect(spellings("ellelle")).toEqual(["ellelle", "ełłełłe"]);
      expect(spellings("łlłlł")).toEqual(["łlłlł", "lllll", "łłłłł"]);
    });
  });

  describe("fold", () => {
    test("folds case and Latin diacritics, keeping offsets", () => {
      const folded = fold("Ça Été");
      expect(folded.text).toBe("ca ete");
      expect(folded.offsets).toEqual([0, 1, 2, 3, 4, 5]);
    });

    test("drops a mark written apart after a Latin letter", () => {
      const folded = fold("e\u0301x");
      expect(folded.text).toBe("ex");
      expect(folded.offsets).toEqual([0, 2]);
    });

    test("keeps the marks of other scripts", () => {
      expect(fold("Йод їжак").text).toBe("йод їжак");
    });

    test("makes look-alike letters plain", () => {
      expect(fold("Ёлка Łódź").text).toBe("елка lodz");
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

    test("ignores Latin diacritics and look-alike letters", () => {
      expect(firstMatch("Un café crème", "creme")).toBe(8);
      expect(firstMatch("Une cafe\u0301 ici", "café ici")).toBe(4);
      expect(firstMatch("Жила-была Ёлка", "елк")).toBe(10);
      expect(firstMatch("w Łodzi", "lodz")).toBe(2);
      expect(firstMatch("мой", "мои")).toBeNull();
    });

    test("is null without a match or a word", () => {
      expect(firstMatch("text", "other")).toBeNull();
      expect(firstMatch("text", " *- ")).toBeNull();
      expect(firstMatch("", "text")).toBeNull();
    });
  });

  describe("non-English text", () => {
    test("Cyrillic: any case, by the start of a word", async () => {
      const search = await searchOver(note("a.md", "Привет МИР, как дела"));
      expect(paths(await search.query("мир"))).toEqual(["a.md"]);
      expect(paths(await search.query("ПРИВ"))).toEqual(["a.md"]);
      expect(await search.query("ривет")).toEqual([]);
    });

    test("е and ё find each other, and the word is highlighted", async () => {
      const search = await searchOver(
        note("a.md", "Ёлка в лесу"),
        note("b.md", "Новая елка"),
      );
      const hits = await search.query("елка");
      expect(paths(hits).sort()).toEqual(["a.md", "b.md"]);
      const a = hits.find((hit) => hit.path === "a.md");
      expect(a && parts(a.snippet, a.snippetMatches)).toEqual(["Ёлка"]);
      expect(paths(await search.query("ёлка")).sort()).toEqual([
        "a.md",
        "b.md",
      ]);
    });

    test("й is not и, ї is not і", async () => {
      const search = await searchOver(
        note("a.md", "мой дом"),
        note("b.md", "Їжак і кіт"),
      );
      expect(await search.query("мои")).toEqual([]);
      expect(paths(await search.query("мой"))).toEqual(["a.md"]);
      expect(await search.query("іжак")).toEqual([]);
      expect(paths(await search.query("їжак"))).toEqual(["b.md"]);
    });

    test("Latin diacritics and ł do not matter", async () => {
      const search = await searchOver(
        note("a.md", "Jadę do Łodzi, zażółć gęślą jaźń"),
        note("b.md", "Über die Brücke"),
      );
      expect(paths(await search.query("lodzi zazolc"))).toEqual(["a.md"]);
      expect(paths(await search.query("łodzi"))).toEqual(["a.md"]);
      expect(paths(await search.query("uber brucke"))).toEqual(["b.md"]);
    });

    test("tells where to open a hit found in another spelling", async () => {
      const text = "# Зима\n\nНа площади стоит Ёлка.";
      const search = await searchOver(note("a.md", text));
      expect(await search.locate("a.md", "елка")).toBe(text.indexOf("Ёлка"));
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
