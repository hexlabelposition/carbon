import { describe, expect, test } from "bun:test";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  clearFormatting,
  cycleHeading,
  insertLink,
  toggleBold,
  toggleBulletList,
  toggleCodeBlock,
  toggleInlineCode,
  toggleItalic,
  toggleOrderedList,
  toggleQuote,
  toggleStrikethrough,
  toggleTaskList,
  type FormatCommand,
} from "./formatting";

/**
 * Runs `command` on `doc`, where "|" is the cursor or "[" and "]" mark a
 * selection, and gives the text after it with the selection marked so.
 */
function run(command: FormatCommand, doc: string): string {
  const open = doc.indexOf("[");
  const cursor = doc.indexOf("|");
  let text: string;
  let selection: EditorSelection;
  if (cursor !== -1) {
    text = doc.slice(0, cursor) + doc.slice(cursor + 1);
    selection = EditorSelection.single(cursor);
  } else {
    const close = doc.indexOf("]", open);
    text =
      doc.slice(0, open) + doc.slice(open + 1, close) + doc.slice(close + 1);
    selection = EditorSelection.single(open, close - 1);
  }
  let state = EditorState.create({
    doc: text,
    selection,
    extensions: [markdown({ base: markdownLanguage })],
  });
  const spec = command(state);
  if (spec === null) return "null";
  state = state.update(spec).state;
  const { from, to } = state.selection.main;
  const out = state.doc.toString();
  return from === to
    ? out.slice(0, from) + "|" + out.slice(from)
    : out.slice(0, from) + "[" + out.slice(from, to) + "]" + out.slice(to);
}

/** Runs `command` on all of `doc` selected, and gives the text after it. */
function all(command: FormatCommand, doc: string): string {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(0, doc.length),
    extensions: [markdown({ base: markdownLanguage })],
  });
  const spec = command(state);
  return spec === null ? "null" : state.update(spec).state.doc.toString();
}

describe("inline marks", () => {
  test("wrap the selection, and take the mark off again", () => {
    expect(run(toggleBold, "a [word] b")).toBe("a **[word]** b");
    expect(run(toggleBold, "a **[word]** b")).toBe("a [word] b");
    expect(run(toggleItalic, "[x]")).toBe("*[x]*");
    expect(run(toggleStrikethrough, "[x]")).toBe("~~[x]~~");
    expect(run(toggleInlineCode, "[x]")).toBe("`[x]`");
  });

  test("put a pair of marks at the cursor", () => {
    expect(run(toggleBold, "a |b")).toBe("a **|**b");
    expect(run(toggleInlineCode, "|")).toBe("`|`");
  });

  test("come off with the cursor anywhere in the marked text", () => {
    expect(run(toggleBold, "a **wo|rd** b")).toBe("a wo|rd b");
    expect(run(toggleItalic, "*wo|rd*")).toBe("wo|rd");
    expect(run(toggleStrikethrough, "~~a|~~")).toBe("a|");
    expect(run(toggleInlineCode, "`co|de`")).toBe("co|de");
  });
});

describe("insertLink", () => {
  test("puts the cursor where the address goes, or the text", () => {
    expect(run(insertLink, "see [docs] now")).toBe("see [docs](|) now");
    expect(run(insertLink, "a |")).toBe("a [|]()");
  });
});

describe("cycleHeading", () => {
  test("goes round none, #, ##, ### and none", () => {
    expect(run(cycleHeading, "Ti|tle")).toBe("# Ti|tle");
    expect(run(cycleHeading, "# Ti|tle")).toBe("## Ti|tle");
    expect(run(cycleHeading, "### Ti|tle")).toBe("Ti|tle");
  });
});

describe("lists", () => {
  test("make each selected line an item, and take it off again", () => {
    expect(run(toggleBulletList, "[a\nb]")).toBe("- [a\n- b]");
    expect(run(toggleBulletList, "- [a\n- b]")).toBe("[a\nb]");
  });

  test("number from 1, and keep the indent", () => {
    expect(run(toggleOrderedList, "[a\n  b]")).toBe("1. [a\n  2. b]");
  });

  test("change the kind of a list in place", () => {
    expect(run(toggleTaskList, "- a|")).toBe("- [ ] a|");
    expect(run(toggleBulletList, "- [ ] a|")).toBe("- a|");
    expect(run(toggleOrderedList, "- a|")).toBe("1. a|");
  });

  test("leave blank lines out", () => {
    expect(run(toggleBulletList, "[a\n\nb]")).toBe("- [a\n\n- b]");
  });
});

describe("toggleQuote", () => {
  test("quotes each line, and takes the quote off again", () => {
    expect(run(toggleQuote, "[a\nb]")).toBe("> [a\n> b]");
    expect(run(toggleQuote, "> [a\n> b]")).toBe("[a\nb]");
  });
});

describe("toggleCodeBlock", () => {
  test("puts fences around the selected lines", () => {
    expect(run(toggleCodeBlock, "[a\nb]")).toBe("```\n[a\nb]\n```");
  });

  test("makes an empty block on an empty line", () => {
    expect(run(toggleCodeBlock, "|")).toBe("```\n|\n```");
  });

  test("takes the fences off inside a block", () => {
    expect(run(toggleCodeBlock, "```js\nco|de\n```")).toBe("co|de");
  });
});

test("does nothing in a note that cannot be edited", () => {
  const state = EditorState.create({
    doc: "x",
    extensions: [EditorState.readOnly.of(true)],
  });
  expect(toggleBold(state)).toBeNull();
});

describe("clearFormatting", () => {
  test("takes inline marks off the selection", () => {
    expect(run(clearFormatting, "[a **b** *c* ~~d~~ `e`]")).toBe("[a b c d e]");
  });

  test("takes the marks around the cursor off", () => {
    expect(run(clearFormatting, "x **bo|ld** y")).toBe("x bo|ld y");
  });

  test("takes headings, list marks and quotes off the lines", () => {
    expect(all(clearFormatting, "## Title\n- item\n- [ ] task\n> quote")).toBe(
      "Title\nitem\ntask\nquote",
    );
    expect(run(clearFormatting, "  1. **a|**")).toBe("  a|");
  });

  test("keeps links", () => {
    expect(all(clearFormatting, "see [x](y) **z**")).toBe("see [x](y) z");
  });
});
