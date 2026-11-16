import { describe, expect, test } from "bun:test";
import { parseFrontmatter, readFrontmatter } from "../src/parser/frontmatter";

/** The frontmatter of a note with these lines of YAML. */
const read = (...lines: string[]) =>
  parseFrontmatter(["---", ...lines, "---", "Body"].join("\n"));

describe("parseFrontmatter", () => {
  test("is empty without frontmatter", () => {
    const empty = { tags: [], aliases: [], properties: {} };
    expect(parseFrontmatter("")).toEqual(empty);
    expect(parseFrontmatter("# tags: [a]")).toEqual(empty);
    expect(parseFrontmatter("\n---\ntags: [a]\n---\n")).toEqual(empty);
    expect(read()).toEqual(empty);
  });

  test("reads a block that ends with ... or with CRLF lines", () => {
    expect(parseFrontmatter("---\ntags: a\n...\n").tags).toEqual(["a"]);
    expect(parseFrontmatter("---\r\ntags: a\r\n---\r\nx").tags).toEqual(["a"]);
  });

  describe("tags", () => {
    test("as a list in either form", () => {
      expect(read("tags: [a, b]").tags).toEqual(["a", "b"]);
      expect(read("tags:", "  - a", "  - b").tags).toEqual(["a", "b"]);
    });

    test("as one string, apart by commas or spaces", () => {
      expect(read("tags: a, b c,d").tags).toEqual(["a", "b", "c", "d"]);
      expect(read("tags: one").tags).toEqual(["one"]);
    });

    test('with or without "#"', () => {
      expect(read('tags: ["#a", b]').tags).toEqual(["a", "b"]);
      expect(read('tags: "#a #b"').tags).toEqual(["a", "b"]);
    });

    test("nested, in any script", () => {
      expect(read("tags: [area/topic, проект/Carbon]").tags).toEqual([
        "area/topic",
        "проект/Carbon",
      ]);
    });

    test("only those an inline tag could be", () => {
      expect(
        read("tags: [2026, '2026', two words, a//b, a/, ok, '', {x: 1}]").tags,
      ).toEqual(["ok"]);
      expect(read("tags: 5").tags).toEqual([]);
      expect(read("tags:").tags).toEqual([]);
    });

    test("once each, ignoring case, as first written", () => {
      expect(read("tags: [Work, work, Ёлка, ёлка, Work]").tags).toEqual([
        "Work",
        "Ёлка",
      ]);
    });
  });

  describe("aliases", () => {
    test("as a list in either form", () => {
      expect(read("aliases: [One, Two]").aliases).toEqual(["One", "Two"]);
      expect(read("aliases:", "  - One", "  - Two").aliases).toEqual([
        "One",
        "Two",
      ]);
    });

    test("as one string, which may have commas and spaces", () => {
      expect(read("aliases: Smith, John").aliases).toEqual(["Smith, John"]);
    });

    test("numbers as text, other values dropped", () => {
      expect(
        read("aliases: [1984, null, {a: 1}, [x], ' ', ok]").aliases,
      ).toEqual(["1984", "ok"]);
      expect(read("aliases: 42").aliases).toEqual(["42"]);
      expect(read("aliases: true").aliases).toEqual([]);
    });

    test("trimmed, once each, ignoring case", () => {
      expect(read("aliases: [' Nick ', nick, Ник, ник]").aliases).toEqual([
        "Nick",
        "Ник",
      ]);
    });
  });

  describe("properties", () => {
    test("are every other key, with YAML values", () => {
      expect(
        read(
          "title: A note",
          "count: 3",
          "done: false",
          "empty:",
          "list: [a, 1]",
          "nested: {a: {b: c}}",
          "date: 2026-11-16",
          "tags: [t]",
          "aliases: [x]",
        ).properties,
      ).toEqual({
        title: "A note",
        count: 3,
        done: false,
        empty: null,
        list: ["a", 1],
        nested: { a: { b: "c" } },
        // The core schema reads no dates: the value stays as written.
        date: "2026-11-16",
      });
    });

    test("keep the last of a repeated key", () => {
      expect(read("a: 1", "a: 2", "tags: x").properties).toEqual({ a: 2 });
    });

    test("keep a key named __proto__ as a key", () => {
      const { properties } = read("__proto__: {polluted: true}");
      expect(Object.keys(properties)).toEqual(["__proto__"]);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe("YAML that does not fit gives nothing", () => {
    test.each([
      ["broken YAML", ["tags: [a", "x: 1"]],
      ["a list", ["- a", "- b"]],
      ["a scalar", ["just text"]],
      ["a bad indent", ["a:", "  b: 1", " c: 2"]],
    ])("%s", (_, lines) => {
      expect(read(...lines)).toEqual({
        tags: [],
        aliases: [],
        properties: {},
      });
    });
  });
});

describe("readFrontmatter", () => {
  test("gives the keys in written order, tags and aliases as lists", () => {
    const text = '---\ntitle: A\ntags: "a, #b"\naliases: Nick\nn: 1\n---\nBody';
    expect(readFrontmatter(text)).toEqual({
      length: text.indexOf("Body"),
      entries: [
        { key: "title", value: "A" },
        { key: "tags", value: ["a", "b"] },
        { key: "aliases", value: ["Nick"] },
        { key: "n", value: 1 },
      ],
    });
  });

  test("is an empty block for empty YAML", () => {
    expect(readFrontmatter("---\n---\n")).toEqual({ length: 8, entries: [] });
    expect(readFrontmatter("---\n\n---")).toEqual({ length: 8, entries: [] });
  });

  test("is null without a frontmatter or with YAML that does not fit", () => {
    expect(readFrontmatter("# Title")).toBeNull();
    expect(readFrontmatter("---\ntags: [a\n---\n")).toBeNull();
    expect(readFrontmatter("---\n- a\n---\n")).toBeNull();
    expect(readFrontmatter("---\njust text\n---\n")).toBeNull();
  });
});
