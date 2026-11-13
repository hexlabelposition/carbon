import { describe, expect, test } from "bun:test";
import { parseNote } from "../src/index";
import { wikiLinkSamples } from "./corpus/wiki-links";

const parse = (text: string, path = "Note.md") => parseNote(path, text);
/** The links as `[target, fragment, alias]`, the easiest form to read. */
const links = (text: string) =>
  parse(text).links.map((link) => [link.target, link.fragment, link.alias]);

describe("parseNote", () => {
  describe("title", () => {
    test.each([
      ["Note.md", "Note"],
      ["projects/Carbon.md", "Carbon"],
      ["a/b/Read me.MD", "Read me"],
      ["v1.2 notes.md", "v1.2 notes"],
    ])("of %s is %s", (path, title) => {
      expect(parse("# Something else", path).title).toBe(title);
    });

    test("keeps the path", () => {
      expect(parse("", "a/b.md").path).toBe("a/b.md");
    });
  });

  describe("headings", () => {
    test("of every kind and level, with their offsets", () => {
      const text = [
        "# One",
        "## Two ##",
        "###### Six",
        "Setext one",
        "===",
        "Setext two",
        "---",
        "> ### In a quote",
        "- #### In a list",
      ].join("\n");
      expect(parse(text).headings).toEqual([
        { level: 1, text: "One", pos: text.indexOf("# One") },
        { level: 2, text: "Two", pos: text.indexOf("## Two") },
        { level: 6, text: "Six", pos: text.indexOf("######") },
        { level: 1, text: "Setext one", pos: text.indexOf("Setext one") },
        { level: 2, text: "Setext two", pos: text.indexOf("Setext two") },
        { level: 3, text: "In a quote", pos: text.indexOf("### In") },
        { level: 4, text: "In a list", pos: text.indexOf("#### In") },
      ]);
    });

    test("as text without Markdown", () => {
      const text =
        "## *Some* **bold** `code` ~~gone~~ [link](x.md) [[Note|alias]] [[Other#Part]] \\# &amp;";
      expect(parse(text).headings[0].text).toBe(
        "Some bold code gone link alias Other Part # &",
      );
    });

    test("not in code or in frontmatter", () => {
      const text = "---\ntitle: x\n---\n```\n# not\n```\n\n    # not";
      expect(parse(text).headings).toEqual([]);
    });
  });

  describe("wiki links", () => {
    test.each(wikiLinkSamples.map((s) => [s.name, s] as const))(
      "%s",
      (_, sample) => {
        const found = parse(sample.markdown).links;
        expect(
          found.map((link) => sample.markdown.slice(link.start, link.end)),
        ).toEqual(sample.links.map((link) => link.text));
      },
    );

    test("are trimmed, with empty parts as null", () => {
      expect(
        links("[[ Note # Part | the alias ]] [[Note#]] [[#Here]]"),
      ).toEqual([
        ["Note", "Part", "the alias"],
        ["Note", null, null],
        ["", "Here", null],
      ]);
    });
  });

  describe("Markdown links", () => {
    test("to local notes, with headings and text", () => {
      expect(
        links(
          '[a](Note.md) [b *c*](../dir/Other.MD#Some%20part) [](x.md) [d](<a b.md>) [e](a%20b.md "title")',
        ),
      ).toEqual([
        ["Note.md", null, "a"],
        ["../dir/Other.MD", "Some part", "b c"],
        ["x.md", null, null],
        ["a b.md", null, "d"],
        ["a b.md", null, "e"],
      ]);
    });

    test("by reference", () => {
      const text = [
        "[text][one] [Two][] [two] [missing][none] [Three]",
        "",
        "[one]: a.md",
        "[TWO]:   <b c.md#Part>",
        "[two]: ignored.md",
        "[three]: https://example.com/c.md",
      ].join("\n");
      expect(links(text)).toEqual([
        ["a.md", null, "text"],
        ["b c.md", "Part", "Two"],
        ["b c.md", "Part", "two"],
      ]);
    });

    test("not to the web, other files, the same note or images", () => {
      expect(
        links(
          "[a](https://x.org/a.md) [b](//x.org/b.md) [c](mailto:c@x.md) [d](pic.png) [e](#part) [f](notes) ![g](g.md) <https://x.md>",
        ),
      ).toEqual([]);
    });

    test("keep a bad escape as written", () => {
      expect(links("[a](100%.md)")).toEqual([["100%.md", null, "a"]]);
    });
  });

  test("lists links in the order they are written", () => {
    const text = "[[A]] [b](b.md) [[C]]";
    expect(parse(text).links.map((link) => [link.start, link.end])).toEqual([
      [0, 5],
      [6, 15],
      [16, 21],
    ]);
  });

  describe("snippets", () => {
    const snippets = (text: string) =>
      parse(text).links.map((link) => link.snippet);

    test("are the plain text of the paragraph around the link", () => {
      expect(
        snippets("See **[[Note|the note]]**\nand `code` [b](b.md).\n\nOther"),
      ).toEqual(["See the note and code b.", "See the note and code b."]);
    });

    test("of a heading, a list item, a quote and a table row", () => {
      const text = [
        "# About [[A]]",
        "",
        "- one",
        "- two [[B]]",
        "",
        "> quoted [[C]]",
        "",
        "| x | y |",
        "| - | - |",
        "| left | [[D]] |",
      ].join("\n");
      expect(snippets(text)).toEqual([
        "About A",
        "two B",
        "quoted C",
        "left D",
      ]);
    });

    test("are cut at a word far from the link", () => {
      const words = (from: number) =>
        Array.from({ length: 30 }, (_, i) => `w${from + i}`).join(" ");
      const [snippet] = snippets(`${words(0)} [[Link]] ${words(100)}`);
      expect(snippet).toStartWith("…");
      expect(snippet).toEndWith("…");
      expect(snippet).toContain("w29 Link w100");
      expect(snippet).not.toContain("w0 ");
      expect(snippet.length).toBeLessThan(180);
      // Every word kept is whole.
      const whole = new Set(`${words(0)} Link ${words(100)}`.split(" "));
      for (const word of snippet.slice(1, -1).split(" ")) {
        expect(whole.has(word)).toBe(true);
      }
    });
  });

  test("tells wiki links from Markdown links", () => {
    const text = "[[A.md]] [a](A.md)";
    expect(parse(text).links.map((link) => link.kind)).toEqual([
      "wiki",
      "markdown",
    ]);
  });

  describe("plain text", () => {
    test("drops the syntax and keeps one block per line", () => {
      const text = [
        "---",
        "tags: [a]",
        "---",
        "# Title",
        "",
        'Some *emphasis*, **bold**, `code`, ~~gone~~ and a [link](https://x.org "t").',
        "Same paragraph with [[Note|alias]], [[Other#Part]] and ![alt](a.png).",
        "",
        "> A quote",
        "> on two lines",
        "",
        "- [ ] a task",
        "1. a number",
        "",
        "```js",
        "const a = 1;",
        "```",
        "",
        "| Head | More |",
        "| --- | --- |",
        "| cell | \\| pipe |",
        "",
        "---",
        "<!-- a comment -->",
        "Escaped \\*stars\\* &amp; H&#x32;O",
        "",
        "[ref]: https://x.org",
      ].join("\n");
      expect(parse(text).plainText).toBe(
        [
          "Title",
          "Some emphasis, bold, code, gone and a link.",
          "Same paragraph with alias, Other Part and alt.",
          "A quote",
          "on two lines",
          "a task",
          "a number",
          "const a = 1;",
          "Head",
          "More",
          "cell",
          "| pipe",
          "Escaped *stars* & H2O",
        ].join("\n"),
      );
    });

    test("is empty for an empty note", () => {
      expect(parse("").plainText).toBe("");
      expect(parse("---\na: 1\n---\n").plainText).toBe("");
    });
  });

  describe("frontmatter", () => {
    test("ends with --- or ..., and needs to start the note", () => {
      expect(parse("---\na: 1\n...\nBody").plainText).toBe("Body");
      expect(parse("---\r\na: 1\r\n---\r\nBody").plainText).toBe("Body");
      expect(parse("\n---\na: 1\n---\nBody").headings).toHaveLength(1);
    });

    test("keeps the offsets of the note", () => {
      const text = "---\na: [[Not a link]]\n---\n# Heading [[Link]]";
      const note = parse(text);
      expect(note.headings[0].pos).toBe(text.indexOf("# Heading"));
      expect(note.links).toEqual([
        {
          kind: "wiki",
          target: "Link",
          alias: null,
          fragment: null,
          start: text.indexOf("[[Link]]"),
          end: text.length,
          snippet: "Heading Link",
        },
      ]);
    });

    test("is not parsed yet", () => {
      const note = parse("---\ntags: [a]\naliases: [b]\nx: 1\n---\n");
      expect(note.tags).toEqual([]);
      expect(note.aliases).toEqual([]);
      expect(note.properties).toEqual({});
    });
  });
});
