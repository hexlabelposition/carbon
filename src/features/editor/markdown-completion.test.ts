import { describe, expect, test } from "bun:test";
import {
  CompletionContext,
  insertBracket,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import {
  suggestCalloutTypes,
  suggestCodeLanguages,
} from "./markdown-completion";
import { markdownInput } from "./markdown-input";

/** A note with the cursor where `|` is. */
function state(doc: string): { state: EditorState; pos: number } {
  const pos = doc.indexOf("|");
  return {
    pos,
    state: EditorState.create({
      doc: doc.replace("|", ""),
      selection: { anchor: pos },
      extensions: [markdown({ base: markdownLanguage }), markdownInput],
    }),
  };
}

function context(doc: string, explicit = false): CompletionContext {
  const { state: s, pos } = state(doc);
  return new CompletionContext(s, pos, explicit);
}

const labels = (result: CompletionResult | null) =>
  result?.options.map((option) => option.label) ?? [];

describe("suggestCodeLanguages", () => {
  test("after a fence, once a letter is typed", () => {
    const result = suggestCodeLanguages(context("```ty|"));
    expect(result?.from).toBe(3);
    expect(labels(result)).toContain("typescript");
  });

  test("all of them on a bare fence only when asked (Ctrl+Space)", () => {
    expect(suggestCodeLanguages(context("```|"))).toBeNull();
    expect(suggestCodeLanguages(context("~~~|", true))?.from).toBe(3);
  });

  test("by name and by short alias or extension, each once", () => {
    const all = labels(suggestCodeLanguages(context("```|", true)));
    for (const label of ["typescript", "ts", "js", "py", "yaml", "yml", "sh"]) {
      expect(all).toContain(label);
    }
    expect(new Set(all).size).toBe(all.length);
  });

  test("not after other text", () => {
    expect(suggestCodeLanguages(context("text ```ty|"))).toBeNull();
  });
});

describe("suggestCalloutTypes", () => {
  test('after "> [!", closing the bracket and leaving room for a title', () => {
    const result = suggestCalloutTypes(context("> [!wa|"));
    expect(result?.from).toBe(4);
    const warning = result?.options.find((o) => o.label === "warning");
    expect(warning?.apply).toBe("warning] ");
  });

  test("without a second bracket when one is there", () => {
    const result = suggestCalloutTypes(context("> [!wa|] Title"));
    const warning = result?.options.find((o) => o.label === "warning");
    expect(warning?.apply).toBe("warning");
  });

  test("all of them only when asked, and not outside a quote", () => {
    expect(suggestCalloutTypes(context("> [!|"))).toBeNull();
    expect(labels(suggestCalloutTypes(context("> [!|", true)))).toContain(
      "note",
    );
    expect(suggestCalloutTypes(context("text [!wa|"))).toBeNull();
  });
});

describe("markdownInput", () => {
  /** The text after typing `char` where the cursor is. */
  function typed(doc: string, char: string): string | null {
    const transaction = insertBracket(state(doc).state, char);
    return transaction?.state.doc.toString() ?? null;
  }

  test("pairs brackets and quotes: [[ becomes [[]]", () => {
    expect(typed("|", "(")).toBe("()");
    expect(typed("[|]", "[")).toBe("[[]]");
    expect(typed("say |", '"')).toBe('say ""');
  });

  test("leaves marks alone while nothing is selected", () => {
    for (const mark of ["`", "*", "_"]) expect(typed("|", mark)).toBeNull();
  });
});
