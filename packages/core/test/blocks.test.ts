import { describe, expect, test } from "bun:test";
import {
  fragmentRange,
  markdownParser,
  newBlockId,
  noteBlocks,
  parseNote,
  Vault,
  withBlockId,
} from "../src/index";
import { createMemoryPlatform } from "./fakes";

/** The ids of a text, as the grammar finds them. */
function ids(text: string): string[] {
  const found: string[] = [];
  markdownParser.parse(text).iterate({
    enter(node) {
      if (node.name === "BlockId") found.push(text.slice(node.from, node.to));
    },
  });
  return found;
}

/** The text of the part a fragment points to. */
function section(text: string, fragment: string): string | null {
  const range = fragmentRange(text, fragment);
  return range === null ? null : text.slice(range.from, range.to);
}

describe("block id grammar", () => {
  test("is read at the end of a block, after white space", () => {
    expect(ids("Some text ^abc-1")).toEqual(["^abc-1"]);
    expect(ids("Two\nlines ^x")).toEqual(["^x"]);
    expect(ids("- item ^li")).toEqual(["^li"]);
    expect(ids("^alone")).toEqual(["^alone"]);
  });

  test("is not read inside a line, after a word or with text after it", () => {
    expect(ids("a ^b c")).toEqual([]);
    expect(ids("word^b")).toEqual([]);
    expect(ids("x^2^ y")).toEqual([]);
    expect(ids("a ^b!")).toEqual([]);
    expect(ids("`code ^x`")).toEqual([]);
  });

  test("leaves superscript as it was", () => {
    let superscripts = 0;
    markdownParser.parse("x^2^ and more").iterate({
      enter(node) {
        if (node.name === "Superscript") superscripts++;
      },
    });
    expect(superscripts).toBe(1);
  });

  test("is not in the plain text, headings or snippets", () => {
    const note = parseNote("n.md", "# Title ^h\n\nText here ^p");
    expect(note.plainText).toBe("Title\nText here");
    expect(note.headings[0]?.text).toBe("Title");
  });
});

describe("noteBlocks", () => {
  test("lists paragraphs, list items, quotes, tables and code", () => {
    const text = [
      "---",
      "a: 1",
      "---",
      "First paragraph ^p1",
      "",
      "- item one ^li",
      "  - nested",
      "- item two",
      "",
      "> quote",
      "> more",
      "^q",
      "",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
      "^tbl",
      "",
      "```js",
      "code",
      "```",
      "^code",
      "",
      "# Heading",
      "",
      "Last *one*",
    ].join("\n");
    const blocks = noteBlocks(text);
    expect(blocks.map((b) => [b.id, b.label])).toEqual([
      ["p1", "First paragraph"],
      ["li", "item one"],
      [null, "nested"],
      [null, "item two"],
      ["q", "quote more"],
      ["tbl", "a b 1 2"],
      ["code", "code"],
      [null, "Last one"],
    ]);
    const quote = blocks[4]!;
    expect(text.slice(quote.from, quote.to)).toBe("> quote\n> more");
    const table = blocks[5]!;
    expect(text.slice(table.from, table.to)).toBe(
      "| a | b |\n|---|---|\n| 1 | 2 |",
    );
  });

  test("the id of a list item names the item with its nested items", () => {
    const text = "- one ^a\n  - two\n- three";
    expect(section(text, "^a")).toBe("- one ^a\n  - two");
  });

  test("an id alone after a list names its last item", () => {
    const text = "- one\n- two\n\n^last";
    expect(section(text, "^last")).toBe("- two");
  });

  test("an id on its own last line of a paragraph names the paragraph", () => {
    const text = "Line one\nline two\n^p";
    expect(section(text, "^p")).toBe("Line one\nline two");
  });
});

describe("fragmentRange", () => {
  const text = [
    "# A",
    "intro",
    "## B",
    "b text ^bid",
    "### C",
    "c text",
    "## D",
    "d text",
  ].join("\n");

  test("finds a block by its id, in any case", () => {
    expect(section(text, "^bid")).toBe("b text ^bid");
    expect(section(text, "^BID")).toBe("b text ^bid");
    expect(section(text, "^none")).toBeNull();
  });

  test("finds the section of a heading, up to one of its level", () => {
    expect(section(text, "B")).toBe("## B\nb text ^bid\n### C\nc text\n");
    expect(section(text, "d")).toBe("## D\nd text");
    expect(section(text, "Missing")).toBeNull();
  });

  test("matches a heading by its text without marks", () => {
    expect(section("## **Bold** one\nx", "Bold one")).toBe(
      "## **Bold** one\nx",
    );
  });
});

describe("withBlockId", () => {
  test("puts the id at the end of a paragraph or a list item", () => {
    const text = "Para\n\n- item\n  - nested\n";
    const [para, item] = noteBlocks(text);
    expect(withBlockId(text, para!, "x1")).toBe(
      "Para ^x1\n\n- item\n  - nested\n",
    );
    expect(withBlockId(text, item!, "x2")).toBe(
      "Para\n\n- item ^x2\n  - nested\n",
    );
  });

  test("puts the id on a line under a table, a quote or code", () => {
    const text = "> quote\nNext\n\n```\ncode\n```";
    const [quote] = noteBlocks(text);
    // "Next" is a lazy line of the quote: the id goes under it.
    const marked = withBlockId(text, quote!, "q");
    expect(marked).toBe("> quote\nNext\n^q\n\n```\ncode\n```");
    const code = noteBlocks(marked).at(-1)!;
    expect(withBlockId(marked, code, "c")).toBe(marked + "\n^c");
  });

  test("keeps a blank line between the id and text that follows", () => {
    const text = "| a |\n|---|\n\nAfter";
    const [table] = noteBlocks(text);
    const marked = withBlockId(text, table!, "t");
    expect(marked).toBe("| a |\n|---|\n^t\n\nAfter");
    expect(noteBlocks(marked)[0]?.id).toBe("t");
  });

  test("an id written by it is found again for the same block", () => {
    const text = "- a\n- b\n\n> q\n\n```\nx\n```\n\nEnd";
    for (const block of noteBlocks(text)) {
      const marked = withBlockId(text, block, "id");
      const again = noteBlocks(marked).find((b) => b.from === block.from);
      expect(again?.id).toBe("id");
    }
  });

  test("newBlockId gives an id the note does not have", () => {
    const id = newBlockId("Text ^abc123");
    expect(id).toMatch(/^[a-z0-9]{6}$/);
    expect(id).not.toBe("abc123");
  });
});

describe("vault.links.blockId", () => {
  async function openVault(files: Record<string, string>) {
    const platform = createMemoryPlatform(
      Object.fromEntries(
        Object.entries(files).map(([path, text]) => [`/v/${path}`, text]),
      ),
    );
    await platform.fs.mkdir("/v");
    const vault = await Vault.open("/v", platform, { changeDelayMs: 5 });
    return { vault, platform };
  }

  test("gives the id a block has", async () => {
    const { vault } = await openVault({ "n.md": "One ^first\n\nTwo" });
    expect(await vault.links.blockId("n.md", 0)).toBe("first");
    vault.close();
  });

  test("writes a new id into the note and tells editors", async () => {
    const { vault } = await openVault({ "n.md": "One\n\nTwo" });
    const rewritten: string[] = [];
    vault.on("rewritten", ({ path }) => rewritten.push(path));
    const id = await vault.links.blockId("n.md", 5);
    expect(await vault.notes.read("n.md")).toBe(`One\n\nTwo ^${id}`);
    expect(rewritten).toEqual(["n.md"]);
    vault.close();
  });

  test("is null where no block starts", async () => {
    const { vault } = await openVault({ "n.md": "One" });
    expect(await vault.links.blockId("n.md", 2)).toBeNull();
    vault.close();
  });
});
