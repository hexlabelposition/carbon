import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/** The code at a place of a note, as "Copy code" puts it on the clipboard. */
export interface CodeAt {
  /** The code alone: no backticks, no fences, no indent of the note. */
  text: string;
  /** A code block, not code inside a line. */
  block: boolean;
}

/**
 * The code at `pos`: the text of inline code without its backticks, or
 * the lines of a code block without its fences. A block inside a list or
 * a quote loses the indent and the ">" marks those add to its lines, so
 * it reads as it would on its own. `null` outside code.
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
        return { text: inlineCode(state, node), block: false };
      }
      if (node.name === "FencedCode") {
        return { text: fencedCode(state, node), block: true };
      }
      if (node.name === "CodeBlock") {
        return { text: indentedCode(state, node), block: true };
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

function fencedCode(state: EditorState, node: SyntaxNode): string {
  // In a list or a quote the code is one piece per line, between the
  // marks and the indent those add.
  const pieces = node.getChildren("CodeText");
  if (pieces.length === 0) return "";
  const code = { from: pieces[0]!.from, to: pieces[pieces.length - 1]!.to };
  // The column of the opening fence: what a list adds before every line.
  const fenceLine = state.doc.lineAt(node.from);
  const indent = node.from - fenceLine.from - quoteWidth(fenceLine.text);
  // The first line of the code starts at its text, the others at the
  // start of their line.
  const first = state.doc.lineAt(code.from);
  const text = state.sliceDoc(first.from, code.to);
  return lines(text, quoteDepth(node), indent).join("\n");
}

function indentedCode(state: EditorState, node: SyntaxNode): string {
  const first = state.doc.lineAt(node.from);
  const text = state.sliceDoc(first.from, node.to);
  const column = node.from - first.from - quoteWidth(first.text);
  // The block starts after its four spaces of indent.
  return lines(text, quoteDepth(node), Math.max(0, column))
    .join("\n")
    .replace(/\n+$/, "");
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
