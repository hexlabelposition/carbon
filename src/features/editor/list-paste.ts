import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

/**
 * The start of a list item before the cursor, and nothing else on the
 * line before it: the indent and quote marks, the marker, and a task box.
 */
const ITEM_START = /^([ \t>]*)(?:[-*+]|\d{1,9}[.)])[ \t]+(\[[ xX]\][ \t]+)?$/;

/** The marker of a list item at the start of the pasted text, and its box. */
const PASTED_MARKER = /^([ \t]*)(?:[-*+]|\d{1,9}[.)])[ \t]+(\[[ xX]\][ \t]+)?/;

/**
 * Text pasted into a list item that has only its marker so far, as
 * "- |": the marker the text starts with is dropped, so "- Text" makes
 * "- Text", not "- - Text"; its task box is dropped too when the item
 * has one, and kept when the item does not. The lines after it, the rest of a pasted
 * list, are set in by the indent of the item, so they stay its siblings
 * and nested items stay nested. Other text, or text pasted elsewhere,
 * is left as it is.
 */
export function pasteIntoListItem(text: string, state: EditorState): string {
  const { main } = state.selection;
  const line = state.doc.lineAt(main.from);
  const before = state.sliceDoc(line.from, main.from);
  const item = ITEM_START.exec(before);
  if (item === null) return text;
  const pasted = PASTED_MARKER.exec(text);
  if (pasted === null) return text;
  // A "- " in a code block is text, not a list.
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(main.from, -1);
  for (; node !== null; node = node.parent) {
    if (node.name === "FencedCode" || node.name === "CodeBlock") return text;
  }
  const indent = item[1];
  const pastedIndent = pasted[1];
  // The box of a pasted task stays when the item has none.
  const marker =
    item[2] === undefined && pasted[2] !== undefined
      ? pasted[0].length - pasted[2].length
      : pasted[0].length;
  const [first, ...rest] = text.slice(marker).split(/(\r?\n)/);
  // `split` with a group keeps the line breaks: every odd part is one.
  let result = first;
  for (let i = 0; i < rest.length; i += 2) {
    const lineBreak = rest[i];
    let next = rest[i + 1] ?? "";
    if (next.startsWith(pastedIndent)) next = next.slice(pastedIndent.length);
    result += lineBreak + (next === "" ? indent.trimEnd() : indent + next);
  }
  return result;
}

/** Applies `pasteIntoListItem` to text pasted into the editor. */
export const listPaste = EditorView.clipboardInputFilter.of(pasteIntoListItem);
