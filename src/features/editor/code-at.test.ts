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

describe("codeAt", () => {
  test("inline code, without its backticks", () => {
    expect(code("Run `bun |test` now")).toEqual({
      text: "bun test",
      block: false,
      line: null,
    });
    expect(code("Run `|x`")?.text).toBe("x");
    expect(code("A `` a ` b| `` c")?.text).toBe("a ` b");
  });

  test("a fenced block, without its fences", () => {
    expect(code("```js\nconst a = 1;|\nconst b = 2;\n```")).toEqual({
      text: "const a = 1;\nconst b = 2;",
      block: true,
      line: "const a = 1;",
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
});
