import { describe, expect, test } from "bun:test";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { continueListItem } from "./list-continue";

/** Presses Enter at "|" in `doc`, and gives the text with the cursor. */
function enter(doc: string): string {
  const at = doc.indexOf("|");
  let state = EditorState.create({
    doc: doc.slice(0, at) + doc.slice(at + 1),
    selection: EditorSelection.cursor(at),
    extensions: markdown({ base: markdownLanguage }),
  });
  const ran = continueListItem({
    state,
    dispatch: (transaction) => {
      state = transaction.state;
    },
  });
  if (!ran) return "(not handled)";
  const head = state.selection.main.head;
  const text = state.doc.toString();
  return text.slice(0, head) + "|" + text.slice(head);
}

describe("Enter in a list", () => {
  test("adds an item right under, in a tight list", () => {
    expect(enter("- one|\n- two\n")).toBe("- one\n- |\n- two\n");
  });

  test("adds no blank line in a loose list", () => {
    expect(enter("- one|\n\n- two\n- three\n")).toBe(
      "- one\n- |\n\n- two\n- three\n",
    );
    expect(enter("- one\n\n- two|\n- three\n")).toBe(
      "- one\n\n- two\n- |\n- three\n",
    );
  });

  test("keeps the indent of a nested loose list", () => {
    expect(enter("- a\n  - one|\n\n  - two\n")).toBe(
      "- a\n  - one\n  - |\n\n  - two\n",
    );
  });

  test("numbers a new item of an ordered loose list", () => {
    expect(enter("1. one|\n\n2. two\n")).toBe("1. one\n2. |\n\n3. two\n");
  });

  test("ends the list on an empty item", () => {
    expect(enter("- one\n- |")).toBe("- one\n|");
  });

  test("continues a quote", () => {
    expect(enter("> one|")).toBe("> one\n> |");
  });

  test("leaves a plain line to the default Enter", () => {
    expect(enter("text|")).toBe("(not handled)");
  });
});
