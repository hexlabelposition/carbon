import { describe, expect, test } from "bun:test";
import { applyChanges, formatNote } from "../src/parser/format-note";

const format = (text: string) => applyChanges(text, formatNote(text));

describe("formatNote", () => {
  test("drops blank lines at the start", () => {
    expect(format("\n\n  \nText\n")).toBe("Text\n");
  });

  test("ends in one line break", () => {
    expect(format("Text")).toBe("Text\n");
    expect(format("Text\n\n\n  \n")).toBe("Text\n");
    expect(format("")).toBe("");
    expect(format("\n\n")).toBe("");
  });

  test("puts one blank line around a heading", () => {
    expect(format("Text\n# Heading\nMore\n")).toBe(
      "Text\n\n# Heading\n\nMore\n",
    );
    expect(format("Text\n\n\n## Heading\n\n\n\nMore\n")).toBe(
      "Text\n\n## Heading\n\nMore\n",
    );
    expect(format("# One\n## Two\n")).toBe("# One\n\n## Two\n");
  });

  test("puts no blank line above a heading at the start", () => {
    expect(format("\n\n# Heading\nText")).toBe("# Heading\n\nText\n");
  });

  test("takes a setext heading as one", () => {
    expect(format("Text\n\nTitle\n=====\nMore\n")).toBe(
      "Text\n\nTitle\n=====\n\nMore\n",
    );
  });

  test("keeps other blank lines as they are", () => {
    const tidy = "One\n\n\nTwo\nThree\n";
    expect(formatNote(tidy)).toEqual([]);
  });

  test("leaves headings in code blocks, lists and quotes", () => {
    const tidy =
      "```\ntext\n# not a heading\n```\n- item\n  # in a list\n> # in a quote\n";
    expect(format(tidy)).toBe(tidy);
  });

  test("starts the body right below the frontmatter", () => {
    expect(format("---\ntitle: A\n---\n\n\n# Heading\nText")).toBe(
      "---\ntitle: A\n---\n# Heading\n\nText\n",
    );
    expect(format("---\ntitle: A\n---\n\n\n")).toBe("---\ntitle: A\n---\n");
  });

  test("keeps the line breaks of the note", () => {
    expect(format("\r\nText\r\n# Heading\r\nMore")).toBe(
      "Text\r\n\r\n# Heading\r\n\r\nMore\r\n",
    );
  });

  test("changes only the lines it tidies", () => {
    const text = "Text\n# Heading\nMore\n";
    expect(formatNote(text)).toEqual([
      { from: 4, to: 4, insert: "\n" },
      { from: 14, to: 14, insert: "\n" },
    ]);
  });
});
