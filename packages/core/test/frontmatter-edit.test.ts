import { describe, expect, test } from "bun:test";
import {
  editFrontmatter,
  propertyValue,
  type PropertyEdit,
} from "../src/index";

/** The note after the edit, or `null` if it cannot be made. */
function edited(text: string, edit: PropertyEdit): string | null {
  const change = editFrontmatter(text, edit);
  if (change === null) return null;
  return text.slice(0, change.from) + change.insert + text.slice(change.to);
}

const note = (...yaml: string[]) => ["---", ...yaml, "---", "Body"].join("\n");

describe("editFrontmatter", () => {
  test("sets a key in its place, or adds it at the end", () => {
    const text = note("title: Old", "n: 1");
    expect(edited(text, { kind: "set", key: "title", value: "New" })).toBe(
      note("title: New", "n: 1"),
    );
    expect(edited(text, { kind: "set", key: "done", value: true })).toBe(
      note("title: Old", "n: 1", "done: true"),
    );
  });

  test("keeps comments, other keys and the body as written", () => {
    const text = note("# Read by the blog", "a: 1 # one", "b: x");
    expect(edited(text, { kind: "set", key: "b", value: "y" })).toBe(
      note("# Read by the blog", "a: 1 # one", "b: y"),
    );
  });

  test("keeps a list on one line if it was", () => {
    expect(
      edited(note("tags: [a, b]"), {
        kind: "set",
        key: "tags",
        value: ["a", "c"],
      }),
    ).toBe(note("tags: [a, c]"));
    expect(
      edited(note("tags:", "  - a"), {
        kind: "set",
        key: "tags",
        value: ["b"],
      }),
    ).toBe(note("tags:", "  - b"));
  });

  test("quotes what YAML would read otherwise, and folds no long line", () => {
    const long = "word ".repeat(30).trim();
    expect(
      edited(note("a: 1"), { kind: "set", key: "author", value: ["[[Me]]"] }),
    ).toBe(note("a: 1", "author:", '  - "[[Me]]"'));
    expect(edited(note("a: 1"), { kind: "set", key: "d", value: long })).toBe(
      note("a: 1", `d: ${long}`),
    );
    expect(edited(note("a: 1"), { kind: "set", key: "s", value: "42" })).toBe(
      note("a: 1", 's: "42"'),
    );
  });

  test("renames a key in its place, with its value", () => {
    expect(
      edited(note("a: 1", "b: [x]", "c: 3"), {
        kind: "rename",
        from: "b",
        to: "tags",
      }),
    ).toBe(note("a: 1", "tags: [x]", "c: 3"));
  });

  test("removes a key, and the last one leaves an empty block", () => {
    expect(edited(note("a: 1", "b: 2"), { kind: "remove", key: "a" })).toBe(
      note("b: 2"),
    );
    expect(edited(note("a: 1"), { kind: "remove", key: "a" })).toBe(note());
  });

  test("fills an empty block, and gives a note without one a block", () => {
    expect(edited(note(), { kind: "set", key: "a", value: 1 })).toBe(
      note("a: 1"),
    );
    expect(edited("# Title", { kind: "set", key: "a", value: null })).toBe(
      "---\na: null\n---\n# Title",
    );
  });

  test("is null when it cannot be made", () => {
    const text = note("a: 1", "b: 2");
    expect(editFrontmatter(text, { kind: "rename", from: "a", to: "b" })).toBe(
      null,
    );
    expect(editFrontmatter(text, { kind: "rename", from: "x", to: "y" })).toBe(
      null,
    );
    expect(editFrontmatter(text, { kind: "remove", key: "x" })).toBeNull();
    expect(editFrontmatter("# T", { kind: "remove", key: "a" })).toBeNull();
    expect(
      editFrontmatter(note("a: [1"), { kind: "set", key: "a", value: 1 }),
    ).toBeNull();
    expect(
      editFrontmatter(note("- a"), { kind: "set", key: "a", value: 1 }),
    ).toBeNull();
  });
});

describe("propertyValue", () => {
  test("splits tags, aliases and lists by commas", () => {
    expect(propertyValue("tags", "#a, b/c,, ", undefined)).toEqual([
      "a",
      "b/c",
    ]);
    expect(propertyValue("aliases", "#One, Two", "x")).toEqual(["#One", "Two"]);
    expect(propertyValue("list", "1, 2", ["x"])).toEqual(["1", "2"]);
    expect(propertyValue("tags", "", ["a"])).toEqual([]);
  });

  test("keeps text as text", () => {
    expect(propertyValue("year", "2026", "2025")).toBe("2026");
  });

  test("reads numbers and true or false, else text", () => {
    expect(propertyValue("n", " 42 ", 1)).toBe(42);
    expect(propertyValue("done", "true", undefined)).toBe(true);
    expect(propertyValue("x", "hello: world", null)).toBe("hello: world");
    expect(propertyValue("x", "[a", undefined)).toBe("[a");
  });

  test("gives null for blank", () => {
    expect(propertyValue("title", "  ", "Old")).toBeNull();
  });
});
