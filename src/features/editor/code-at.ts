import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/** The code at a place of a note, as "Copy code" puts it on the clipboard. */
export interface CodeAt {
  /** The code alone: no backticks, no fences, no indent of the note. */
  text: string;
  /** A code block, not code inside a line. */
  block: boolean;
  /**
   * The line of a code block at the place, without the spaces around it,
   * which only matter among the other lines. `null` for inline code, on a
   * fence and on a blank line.
   */
  line: string | null;
}

/**
 * The code at `pos`: the text of inline code without its backticks, or
 * the lines of a code block without its fences. A block inside a list or
 * a quote loses the indent and the ">" marks those add to its lines, so
 * it reads as it would on its own; so does the line at `pos`. `null`
 * outside code.
 */
export function codeAt(state: EditorState, pos: number): CodeAt | null {
  const tree = ensureSyntaxTree(state, pos, 50) ?? syntaxTree(state);
  for (const side of [1, -1] as const) {
    for (
      let node: SyntaxNode | null = tree.resolveInner(pos, side);
      node !== null;
      node = node.parent
    ) {
      if (node.name === "InlineCode") {
        return { text: inlineCode(state, node), block: false, line: null };
      }
      if (node.name === "FencedCode" || node.name === "CodeBlock") {
        const code =
          node.name === "FencedCode"
            ? fencedCode(state, node)
            : indentedCode(state, node);
        const line = code.lines[state.doc.lineAt(pos).number - code.first];
        return {
          text: code.lines.join("\n"),
          block: true,
          line: line === undefined || line.trim() === "" ? null : line.trim(),
        };
      }
    }
  }
  return null;
}

/** "`` `a` ``" reads as "`a`": the marks and one space inside each. */
function inlineCode(state: EditorState, node: SyntaxNode): string {
  const marks = node.getChildren("CodeMark");
  const from = marks[0]?.to ?? node.from;
  const to = marks.length > 1 ? marks[marks.length - 1]!.from : node.to;
  const text = state.sliceDoc(from, to);
  // As CommonMark: one space on both sides is taken off, unless the code
  // is nothing but spaces.
  return /^ .* $/s.test(text) && text.trim() !== "" ? text.slice(1, -1) : text;
}

/** The lines of a block, and the number of the first in the note. */
interface BlockLines {
  lines: string[];
  first: number;
}

function fencedCode(state: EditorState, node: SyntaxNode): BlockLines {
  // In a list or a quote the code is one piece per line, between the
  // marks and the indent those add.
  const pieces = node.getChildren("CodeText");
  if (pieces.length === 0) return { lines: [], first: 0 };
  const code = { from: pieces[0]!.from, to: pieces[pieces.length - 1]!.to };
  // The column of the opening fence: what a list adds before every line.
  const fenceLine = state.doc.lineAt(node.from);
  const indent = node.from - fenceLine.from - quoteWidth(fenceLine.text);
  // The first line of the code starts at its text, the others at the
  // start of their line.
  const first = state.doc.lineAt(code.from);
  const text = state.sliceDoc(first.from, code.to);
  return { lines: lines(text, quoteDepth(node), indent), first: first.number };
}

function indentedCode(state: EditorState, node: SyntaxNode): BlockLines {
  const first = state.doc.lineAt(node.from);
  const text = state.sliceDoc(first.from, node.to);
  const column = node.from - first.from - quoteWidth(first.text);
  // The block starts after its four spaces of indent; the blank lines
  // that end it are not code.
  const all = lines(text, quoteDepth(node), Math.max(0, column));
  while (all.length > 0 && all[all.length - 1]!.trim() === "") all.pop();
  return { lines: all, first: first.number };
}

/** Lines of `text` without `depth` quote marks and `indent` spaces each. */
function lines(text: string, depth: number, indent: number): string[] {
  return text.split("\n").map((line) => {
    let rest = line;
    for (let i = 0; i < depth; i++) {
      const mark = /^ {0,3}> ?/.exec(rest);
      if (mark === null) break;
      rest = rest.slice(mark[0].length);
    }
    let spaces = 0;
    while (spaces < indent && rest[spaces] === " ") spaces++;
    return rest.slice(spaces);
  });
}

/** How many quotes the node is in. */
function quoteDepth(node: SyntaxNode): number {
  let depth = 0;
  for (let at = node.parent; at !== null; at = at.parent) {
    if (at.name === "Blockquote") depth++;
  }
  return depth;
}

/** How wide the quote marks at the start of a line are, with their spaces. */
function quoteWidth(line: string): number {
  return /^(?: {0,3}> ?)*/.exec(line)?.[0].length ?? 0;
}
