import { describe, expect, test } from "bun:test";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { pasteIntoListItem } from "./list-paste";

/** Pastes `text` at "|" in `doc`, and gives the new text. */
function paste(doc: string, text: string): string {
  const at = doc.indexOf("|");
  const state = EditorState.create({
    doc: doc.slice(0, at) + doc.slice(at + 1),
    selection: EditorSelection.cursor(at),
    extensions: markdown({ base: markdownLanguage }),
  });
  const pasted = pasteIntoListItem(text, state);
  return state.doc.sliceString(0, at) + pasted + state.doc.sliceString(at);
}

describe("pasting into a list item", () => {
  test("drops the marker of the pasted item", () => {
    expect(paste("- |", "- Text")).toBe("- Text");
    expect(paste("* |", "- Text")).toBe("* Text");
    expect(paste("1. |", "2) Text")).toBe("1. Text");
    expect(paste("text\n- |", "- Text")).toBe("text\n- Text");
  });

  test("drops a task box too", () => {
    expect(paste("- [ ] |", "- [x] Done")).toBe("- [ ] Done");
    expect(paste("- |", "- [ ] Task")).toBe("- [ ] Task");
  });

  test("sets the rest of a pasted list in by the indent of the item", () => {
    expect(paste("- one\n  - |", "- a\n- b\n  - c")).toBe(
      "- one\n  - a\n  - b\n    - c",
    );
    expect(paste("> - |", "- a\n- b")).toBe("> - a\n> - b");
  });

  test("takes the indent the pasted list had off its lines", () => {
    expect(paste("- |", "  - a\n  - b\n    - c")).toBe("- a\n- b\n  - c");
  });

  test("keeps blank lines blank", () => {
    expect(paste("  - |", "- a\n\n- b")).toBe("  - a\n\n  - b");
  });

  test("leaves other text as it is", () => {
    expect(paste("- |", "Text")).toBe("- Text");
    expect(paste("- one |", "- Text")).toBe("- one - Text");
    expect(paste("|", "- Text")).toBe("- Text");
    expect(paste("Some |", "- Text")).toBe("Some - Text");
  });

  test("leaves a list in a code block as it is", () => {
    expect(paste("```\n- |\n```", "- Text")).toBe("```\n- - Text\n```");
  });
});
