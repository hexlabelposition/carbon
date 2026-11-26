import { syntaxTree } from "@codemirror/language";
import {
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type Line,
  type SelectionRange,
  type TransactionSpec,
} from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/**
 * Formatting of Markdown, as the buttons of the formatting bar do it.
 * Each command takes the state and gives the change to dispatch, or
 * `null` when there is nothing to do (in a note that cannot be edited).
 */
export type FormatCommand = (state: EditorState) => TransactionSpec | null;

/** An inline mark: what it is written with, and the node the parser makes. */
interface InlineMark {
  mark: string;
  node: string;
  /** For marks the parser shares between kinds, the length of the one. */
  length?: number;
}

const BOLD: InlineMark = { mark: "**", node: "StrongEmphasis" };
const ITALIC: InlineMark = { mark: "*", node: "Emphasis" };
const STRIKE: InlineMark = { mark: "~~", node: "Strikethrough" };
const CODE: InlineMark = { mark: "`", node: "InlineCode" };

/**
 * Bold, italic, strikethrough or inline code on each selection: around
 * the selected text, or a pair of marks with the cursor between them. In
 * text that has the mark already, the mark is taken off instead.
 */
function toggleInline(kind: InlineMark): FormatCommand {
  return (state) => {
    if (state.readOnly) return null;
    return {
      ...state.changeByRange((range) => {
        const around = enclosing(state, range, kind.node);
        if (around !== null) return unwrap(state, range, around);
        const { mark } = kind;
        if (range.empty) {
          return {
            changes: { from: range.from, insert: mark + mark },
            range: EditorSelection.cursor(range.from + mark.length),
          };
        }
        return {
          changes: [
            { from: range.from, insert: mark },
            { from: range.to, insert: mark },
          ],
          range: EditorSelection.range(
            range.from + mark.length,
            range.to + mark.length,
          ),
        };
      }),
      scrollIntoView: true,
      userEvent: "input.format",
    };
  };
}

/** The node named `name` the whole of `range` is in, or `null`. */
function enclosing(
  state: EditorState,
  range: SelectionRange,
  name: string,
): SyntaxNode | null {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(range.from, 1);
    node !== null;
    node = node.parent
  ) {
    if (node.name === name && node.from <= range.from && node.to >= range.to) {
      return node;
    }
  }
  // The cursor just after the closing mark, as after typing it.
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(
      range.from,
      -1,
    );
    node !== null;
    node = node.parent
  ) {
    if (node.name === name && node.from <= range.from && node.to >= range.to) {
      return node;
    }
  }
  return null;
}

/** Takes the marks off `node`, keeping the selection on the same text. */
function unwrap(state: EditorState, range: SelectionRange, node: SyntaxNode) {
  const first = node.firstChild;
  const last = node.lastChild;
  const open = first !== null && /Mark$/.test(first.name) ? first : null;
  const close =
    last !== null && last !== first && /Mark$/.test(last.name) ? last : null;
  const changes: ChangeSpec[] = [];
  if (open !== null) changes.push({ from: open.from, to: open.to });
  if (close !== null) changes.push({ from: close.from, to: close.to });
  const set = state.changes(changes);
  return {
    changes: set,
    range: EditorSelection.range(
      set.mapPos(range.anchor, -1),
      set.mapPos(range.head, -1),
    ),
  };
}

export const toggleBold = toggleInline(BOLD);
export const toggleItalic = toggleInline(ITALIC);
export const toggleStrikethrough = toggleInline(STRIKE);
export const toggleInlineCode = toggleInline(CODE);

/**
 * A link: the selected text in "[text](|)" with the cursor where the
 * address goes, or "[|]()" with the cursor where the text goes.
 */
export const insertLink: FormatCommand = (state) => {
  if (state.readOnly) return null;
  return {
    ...state.changeByRange((range) => {
      if (range.empty) {
        return {
          changes: { from: range.from, insert: "[]()" },
          range: EditorSelection.cursor(range.from + 1),
        };
      }
      return {
        changes: [
          { from: range.from, insert: "[" },
          { from: range.to, insert: "]()" },
        ],
        range: EditorSelection.cursor(range.to + 3),
      };
    }),
    scrollIntoView: true,
    userEvent: "input.format",
  };
};

/** The lines the selection is on, each once. */
function selectedLines(state: EditorState): Line[] {
  const lines: Line[] = [];
  let last = -1;
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    // A selection that ends at the start of a line leaves that line out.
    const end = state.doc.lineAt(range.to);
    const lastLine =
      range.to === end.from && range.to > range.from
        ? end.number - 1
        : end.number;
    for (let n = Math.max(first, last + 1); n <= lastLine; n++) {
      lines.push(state.doc.line(n));
      last = n;
    }
  }
  return lines;
}

/** Changes on whole lines; the selection follows the text. */
function onLines(
  state: EditorState,
  change: (line: Line, index: number, lines: Line[]) => ChangeSpec | null,
): TransactionSpec | null {
  if (state.readOnly) return null;
  const lines = selectedLines(state);
  const changes = state.changes(
    lines
      .map((line, index) => change(line, index, lines))
      .filter((spec): spec is ChangeSpec => spec !== null),
  );
  return {
    changes,
    selection: state.selection.map(changes, 1),
    scrollIntoView: true,
    userEvent: "input.format",
  };
}

/** The indent of a line and what list or quote mark follows it. */
const LINE_START =
  /^(\s*)((?:>\s?)*)((?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?(#{1,6}\s+)?/;

function parts(line: Line) {
  const match = LINE_START.exec(line.text)!;
  const [, indent = "", quote = "", list = "", heading = ""] = match;
  return { indent, quote, list, heading };
}

/**
 * The heading of each selected line one level further, round the levels
 * a note mostly uses: none, "#", "##", "###", and none again.
 */
export const cycleHeading: FormatCommand = (state) =>
  onLines(state, (line) => {
    const { indent, quote, list, heading } = parts(line);
    const level = heading.trim().length;
    const next = level >= 3 ? "" : `${"#".repeat(level + 1)} `;
    const from = line.from + indent.length + quote.length + list.length;
    return { from, to: from + heading.length, insert: next };
  });

type ListKind = "bullet" | "ordered" | "task";

const LIST_PATTERNS: Record<ListKind, RegExp> = {
  bullet: /^[-*+]\s+(?!\[[ xX]\]\s)/,
  ordered: /^\d+[.)]\s+/,
  task: /^[-*+]\s+\[[ xX]\]\s+/,
};

/**
 * A list on the selected lines: if every one is already that kind of
 * list, its marks come off; otherwise each line becomes an item of it,
 * in place of the mark of another kind. A numbered list counts from 1.
 */
function toggleList(kind: ListKind): FormatCommand {
  return (state) => {
    const lines = selectedLines(state).filter((line) => line.text.trim());
    const all =
      lines.length > 0 &&
      lines.every((line) => LIST_PATTERNS[kind].test(parts(line).list));
    let number = 0;
    return onLines(state, (line) => {
      if (line.text.trim() === "") return null;
      const { indent, quote, list } = parts(line);
      const from = line.from + indent.length + quote.length;
      const mark =
        kind === "bullet" ? "- " : kind === "task" ? "- [ ] " : `${++number}. `;
      return { from, to: from + list.length, insert: all ? "" : mark };
    });
  };
}

export const toggleBulletList = toggleList("bullet");
export const toggleOrderedList = toggleList("ordered");
export const toggleTaskList = toggleList("task");

/**
 * A quote on the selected lines: "> " before each, or off if every one
 * has it already.
 */
export const toggleQuote: FormatCommand = (state) => {
  const lines = selectedLines(state);
  const all = lines.every((line) => parts(line).quote !== "");
  return onLines(state, (line) => {
    const { indent, quote } = parts(line);
    const from = line.from + indent.length;
    if (all) return { from, to: from + quote.length };
    return { from, insert: "> " };
  });
};

/**
 * A code block around the selected lines, or an empty one with the cursor
 * inside it. Inside a code block, its fences come off.
 */
export const toggleCodeBlock: FormatCommand = (state) => {
  if (state.readOnly) return null;
  const range = state.selection.main;
  const block = enclosing(state, range, "FencedCode");
  if (block !== null) {
    const open = state.doc.lineAt(block.from);
    const close = state.doc.lineAt(block.to);
    const closed =
      close.number > open.number && /^\s*(`{3,}|~{3,})\s*$/.test(close.text);
    const changes: ChangeSpec[] = [
      { from: open.from, to: Math.min(open.to + 1, state.doc.length) },
    ];
    if (closed) changes.push({ from: close.from - 1, to: close.to });
    const set = state.changes(changes);
    return {
      changes: set,
      selection: state.selection.map(set, -1),
      scrollIntoView: true,
      userEvent: "input.format",
    };
  }
  const first = state.doc.lineAt(range.from);
  const last = state.doc.lineAt(range.to);
  if (range.empty && first.text.trim() === "") {
    return {
      changes: { from: first.from, to: first.to, insert: "```\n\n```" },
      selection: { anchor: first.from + 4 },
      scrollIntoView: true,
      userEvent: "input.format",
    };
  }
  return {
    changes: [
      { from: first.from, insert: "```\n" },
      { from: last.to, insert: "\n```" },
    ],
    selection: EditorSelection.range(range.anchor + 4, range.head + 4),
    scrollIntoView: true,
    userEvent: "input.format",
  };
};

/** The inline marks "Clear formatting" takes off. */
const CLEARED = new Set([
  "StrongEmphasis",
  "Emphasis",
  "Strikethrough",
  "InlineCode",
]);

/**
 * Takes the formatting off: bold, italic, strikethrough and inline code
 * in the selection (at the cursor, the ones around it), and headings,
 * list marks and quotes on its lines, keeping their indent. Links and code
 * blocks stay: they are content, not looks.
 */
export const clearFormatting: FormatCommand = (state) => {
  if (state.readOnly) return null;
  const changes: ChangeSpec[] = [];
  const seen = new Set<number>();
  const remove = (from: number, to: number) => {
    if (from >= to || seen.has(from)) return;
    seen.add(from);
    changes.push({ from, to });
  };
  const clear = (node: SyntaxNode) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (/Mark$/.test(child.name)) remove(child.from, child.to);
    }
  };
  const tree = syntaxTree(state);
  for (const range of state.selection.ranges) {
    if (range.empty) {
      for (const side of [1, -1] as const) {
        for (
          let node: SyntaxNode | null = tree.resolveInner(range.from, side);
          node !== null;
          node = node.parent
        ) {
          if (CLEARED.has(node.name)) clear(node);
        }
      }
    } else {
      tree.iterate({
        from: range.from,
        to: range.to,
        enter: ({ name, node }) => {
          if (CLEARED.has(name)) clear(node);
        },
      });
    }
  }
  for (const line of selectedLines(state)) {
    const { indent, quote, list, heading } = parts(line);
    const from = line.from + indent.length;
    remove(from, from + quote.length + list.length + heading.length);
  }
  if (changes.length === 0) return null;
  const set = state.changes(changes);
  return {
    changes: set,
    selection: state.selection.map(set, 1),
    scrollIntoView: true,
    userEvent: "input.format",
  };
};
