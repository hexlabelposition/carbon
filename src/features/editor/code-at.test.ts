import { describe, expect, test } from "bun:test";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { codeAt } from "./code-at";

/** The code where `|` is in `doc`. */
function code(doc: string) {
  const pos = doc.indexOf("|");
  const state = EditorState.create({
    doc: doc.slice(0, pos) + doc.slice(pos + 1),
    extensions: [markdown({ base: markdownLanguage })],
  });
  return codeAt(state, pos);
}

/** The lines selected between `[` and `]` in `doc`, the menu opened at `[`. */
function selectedLines(doc: string) {
  const from = doc.indexOf("[");
  const to = doc.indexOf("]") - 1;
  const state = EditorState.create({
    doc: doc.replace("[", "").replace("]", ""),
    extensions: [markdown({ base: markdownLanguage })],
  });
  return codeAt(state, from, { from, to })?.lines ?? null;
}

describe("codeAt", () => {
  test("inline code, without its backticks", () => {
    expect(code("Run `bun |test` now")).toEqual({
      text: "bun test",
      block: false,
      line: null,
      lines: null,
    });
    expect(code("Run `|x`")?.text).toBe("x");
    expect(code("A `` a ` b| `` c")?.text).toBe("a ` b");
  });

  test("a fenced block, without its fences", () => {
    expect(code("```js\nconst a = 1;|\nconst b = 2;\n```")).toEqual({
      text: "const a = 1;\nconst b = 2;",
      block: true,
      line: "const a = 1;",
      lines: null,
    });
    // On the fence itself too, and in a block that is not closed.
    expect(code("|```\nx\n```")?.text).toBe("x");
    expect(code("~~~\n|a\n  b")?.text).toBe("a\n  b");
    expect(code("```\n|```")?.text).toBe("");
  });

  test("a block in a list loses the indent of the list", () => {
    const doc = "- item\n\n  ```py\n  if x:\n      |y()\n  ```";
    expect(code(doc)?.text).toBe("if x:\n    y()");
  });

  test("a block in a quote loses its quote marks", () => {
    const doc = "> ```\n> a|\n>  b\n> ```";
    expect(code(doc)?.text).toBe("a\n b");
  });

  test("an indented block, without its indent", () => {
    expect(code("Text\n\n    one|\n      two\n")?.text).toBe("one\n  two");
  });

  test("nothing outside code", () => {
    expect(code("Plain |text")).toBeNull();
    expect(code("**bold|**")).toBeNull();
  });

  test("the line of a block at the place, without its indent", () => {
    expect(code("```\na\n  b|\n```")?.line).toBe("b");
    expect(code("- x\n\n  ```\n  one\n    |two\n  ```")?.line).toBe("two");
    expect(code("> ```\n> |q\n> ```")?.line).toBe("q");
    expect(code("Text\n\n    one\n    tw|o\n")?.line).toBe("two");
  });

  test("no line on a fence or a blank line", () => {
    expect(code("|```\nx\n```")?.line).toBeNull();
    expect(code("```\nx\n|```")?.line).toBeNull();
    expect(code("```\nx\n|\ny\n```")?.line).toBeNull();
  });

  test("the whole lines a selection runs over, two or more, by number", () => {
    expect(selectedLines("```\na\nb[c\nd]e\nf\n```")).toMatchObject({
      text: "bc\nde",
      count: 2,
    });
  });

  test("none for a selection of one line or none", () => {
    expect(selectedLines("```\na[b]c\nd\n```")).toBeNull();
    expect(selectedLines("```\na[]\nb\n```")).toBeNull();
  });

  test("a selection ending at the start of a line leaves it out", () => {
    expect(selectedLines("```\n[a\nb\n]c\n```")).toMatchObject({
      text: "a\nb",
      count: 2,
    });
    expect(selectedLines("```\n[a\n]b\n```")).toBeNull();
  });

  test("less the indent the lines share, the rest of it kept", () => {
    expect(
      selectedLines("```\nfn() {\n  [if (x) {\n    y();\n  }]\n}\n```"),
    ).toEqual({ text: "if (x) {\n  y();\n}", count: 3, first: 3, last: 5 });
  });

  test("without the fences or the blank lines at the ends", () => {
    expect(selectedLines("[```\n\na\nb\n```]")).toMatchObject({
      text: "a\nb",
      count: 2,
    });
  });

  test("in a list or a quote, without its indent and marks", () => {
    expect(selectedLines("> ```\n> [one\n> two]\n> ```")).toMatchObject({
      text: "one\ntwo",
      count: 2,
    });
    expect(selectedLines("- x\n\n  ```\n  [a\n    b]\n  ```")).toMatchObject({
      text: "a\n  b",
      count: 2,
    });
  });
});
