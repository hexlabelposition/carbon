import { syntaxTree } from "@codemirror/language";
import {
  Prec,
  StateField,
  type EditorState,
  type Range,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { wikiLinkLabel } from "./wiki-link";
import { noteSize } from "./editor-theme";

/**
 * Live preview of tables: a table is drawn as a table, except while the
 * cursor is in it, when it shows its Markdown, in a monospace font so the
 * columns can be lined up by hand. A click on a cell puts the cursor there.
 *
 * Only tables at the top level of the note are drawn; one inside a quote or
 * a list item stays as text.
 *
 * A drawn table replaces several lines at once, which CodeMirror only
 * allows from a state field, not from a view plugin like the rest of the
 * live preview. A field cannot see whether the editor has the focus, so a
 * table stays raw while the cursor is in it even when the focus is not.
 * In reading mode a table is always drawn and a click leaves it drawn.
 */
export const tablePreview = [
  StateField.define<DecorationSet>({
    create: decorate,
    update(decorations, transaction) {
      const changed =
        transaction.docChanged ||
        transaction.selection !== undefined ||
        // Reading mode turned on or off.
        transaction.reconfigured ||
        // Parsing a long note finishes in the background.
        syntaxTree(transaction.startState) !== syntaxTree(transaction.state);
      return changed ? decorate(transaction.state) : decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
  }),
  // The up and down keys would step over a drawn table as over one tall
  // line. These put the cursor into its Markdown instead, so a table can
  // be reached, and so edited, without the mouse.
  Prec.high(
    keymap.of([
      { key: "ArrowDown", run: (view) => enterTable(view, 1) },
      { key: "ArrowUp", run: (view) => enterTable(view, -1) },
    ]),
  ),
  EditorView.baseTheme({
    // As wide as its text, never wider than the note: a long cell wraps.
    // A box with rounded corners, as a code block, lines between the
    // columns and the rows. The borders are kept apart, not collapsed:
    // collapsed, a table cannot have rounded corners.
    ".cm-table": {
      borderCollapse: "separate",
      borderSpacing: "0",
      border: "1px solid var(--cb-line)",
      borderRadius: "6px",
      fontSize: noteSize(14),
      cursor: "text",
    },
    ".cm-table th, .cm-table td": {
      padding: "6px 12px",
      borderRight: "1px solid var(--cb-line)",
      borderBottom: "1px solid var(--cb-line)",
      textAlign: "left",
      verticalAlign: "top",
    },
    ".cm-table tr > :last-child": { borderRight: "none" },
    ".cm-table tbody tr:last-child > *": { borderBottom: "none" },
    // A table of only a header: the line below it is the box itself.
    ".cm-table:not(:has(tbody tr)) th": { borderBottom: "none" },
    ".cm-table th": {
      fontSize: noteSize(12),
      fontWeight: "600",
      color: "var(--cb-faint)",
      backgroundColor: "var(--cb-code)",
    },
    // The header keeps inside the rounded corners of the box.
    ".cm-table th:first-child": { borderTopLeftRadius: "5px" },
    ".cm-table th:last-child": { borderTopRightRadius: "5px" },
    ".cm-table code": {
      padding: "1px 5px",
      border: "1px solid var(--cb-line)",
      borderRadius: "4px",
      backgroundColor: "var(--cb-code)",
      fontFamily: "var(--cb-mono-font)",
      fontSize: noteSize(13),
    },
    ".cm-table strong": { fontWeight: "600" },
    ".cm-table del": { color: "var(--cb-faint)" },
    ".cm-table .cm-table-link": { color: "var(--cb-link)" },
    ".cm-line.cm-table-source": {
      fontFamily: "var(--cb-mono-font)",
      fontSize: noteSize(13),
    },
  }),
];

/** Formatted text inside a cell: plain text, or an element around more. */
type Inline = string | { tag: string; children: Inline[] };

interface Cell {
  content: Inline[];
  /** Where the cell starts, counted from the start of the table. */
  offset: number;
}

type Align = "left" | "center" | "right" | null;

interface TableModel {
  header: Cell[];
  rows: Cell[][];
  /** One entry per column of the delimiter row. */
  align: Align[];
}

const sourceLine = Decoration.line({ class: "cm-table-source" });

function decorate(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  // Nothing is edited in reading mode, wherever the cursor was left.
  const editing = (from: number, to: number) =>
    !state.readOnly &&
    state.selection.ranges.some(
      (range) => range.from <= to && range.to >= from,
    );

  // Tables are blocks: only the top level is walked, not the whole tree.
  const top = syntaxTree(state).topNode;
  for (let node = top.firstChild; node !== null; node = node.nextSibling) {
    if (node.name !== "Table") continue;
    if (editing(node.from, node.to)) {
      for (let pos = node.from; pos <= node.to;) {
        const line = state.doc.lineAt(pos);
        ranges.push(sourceLine.range(line.from));
        pos = line.to + 1;
      }
    } else {
      const widget = new TableWidget(
        state.sliceDoc(node.from, node.to),
        readTable(state, node),
      );
      ranges.push(
        Decoration.replace({ widget, block: true }).range(node.from, node.to),
      );
    }
  }
  return Decoration.set(ranges, true);
}

/**
 * If a top-level table starts on the line below the cursor (`direction` 1)
 * or ends on the line above it (-1), moves the cursor to that line.
 */
function enterTable(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view;
  const { main } = state.selection;
  if (!main.empty) return false;
  const line = state.doc.lineAt(main.head);
  const target = direction === 1 ? line.to + 1 : line.from - 1;
  if (target < 0 || target > state.doc.length) return false;

  let node: SyntaxNode | null = syntaxTree(state).resolveInner(
    target,
    direction,
  );
  while (node !== null && node.name !== "Table") node = node.parent;
  const isEdge =
    node !== null &&
    node.parent?.parent === null &&
    (direction === 1 ? node.from === target : node.to === target);
  if (!isEdge) return false;

  view.dispatch({
    selection: { anchor: state.doc.lineAt(target).from },
    scrollIntoView: true,
  });
  return true;
}

class TableWidget extends WidgetType {
  constructor(
    /** The Markdown of the table: two tables with equal source are equal. */
    private readonly source: string,
    private readonly model: TableModel,
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return other.source === this.source;
  }

  toDOM(view: EditorView): HTMLElement {
    const table = document.createElement("table");
    table.className = "cm-table";
    const addRow = (parent: HTMLElement, cells: Cell[], tag: "th" | "td") => {
      const row = parent.appendChild(document.createElement("tr"));
      cells.forEach((cell, column) => {
        const element = row.appendChild(document.createElement(tag));
        const align = this.model.align[column];
        if (align) element.style.textAlign = align;
        element.dataset.offset = String(cell.offset);
        appendInline(element, cell.content);
      });
    };
    addRow(
      table.appendChild(document.createElement("thead")),
      this.model.header,
      "th",
    );
    const body = table.appendChild(document.createElement("tbody"));
    for (const row of this.model.rows) addRow(body, row, "td");

    // A click on a cell puts the cursor at that cell in the Markdown,
    // which also turns the table back into text.
    // In reading mode the click does nothing: text can still be selected.
    table.addEventListener("mousedown", (event) => {
      if (view.state.readOnly) return;
      const cell = (event.target as Element).closest<HTMLElement>("th, td");
      event.preventDefault();
      // Where the table starts now: the text above it may have changed
      // since it was drawn.
      const start = view.posAtDOM(table);
      view.dispatch({
        selection: { anchor: start + Number(cell?.dataset.offset ?? 0) },
      });
      view.focus();
    });
    return table;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function appendInline(parent: HTMLElement, content: Inline[]): void {
  for (const part of content) {
    if (typeof part === "string") {
      parent.append(part);
      continue;
    }
    // A link is shown by its text; it cannot be followed from here yet.
    const element =
      part.tag === "a"
        ? Object.assign(document.createElement("span"), {
            className: "cm-table-link",
          })
        : document.createElement(part.tag);
    appendInline(element, part.children);
    parent.append(element);
  }
}

function readTable(state: EditorState, table: SyntaxNode): TableModel {
  const model: TableModel = { header: [], rows: [], align: [] };
  for (let node = table.firstChild; node !== null; node = node.nextSibling) {
    if (node.name === "TableHeader") {
      model.header = readRow(state, node, table.from);
    } else if (node.name === "TableRow") {
      // "^id" under a table names it (`blockIds`): it is no row.
      if (node.nextSibling === null && isBlockIdRow(state, node)) continue;
      model.rows.push(readRow(state, node, table.from));
    } else if (node.name === "TableDelimiter") {
      model.align = readAlign(state.sliceDoc(node.from, node.to));
    }
  }
  return model;
}

/** Whether a row is only a block id, as "^id" under a table reads. */
function isBlockIdRow(state: EditorState, row: SyntaxNode): boolean {
  const cells = row.getChildren("TableCell");
  return (
    cells.length === 1 &&
    row.getChild("TableDelimiter") === null &&
    cells[0]!.firstChild?.name === "BlockId" &&
    /^\s*\^[A-Za-z0-9-]+\s*$/.test(state.sliceDoc(row.from, row.to))
  );
}

/**
 * The cells of one row. The parser has no node for an empty cell, so the
 * cells are counted by the "|" between them, not by their nodes.
 */
function readRow(
  state: EditorState,
  row: SyntaxNode,
  tableFrom: number,
): Cell[] {
  const cells: Cell[] = [];
  let content: Inline[] | null = null;
  let offset = row.from - tableFrom;
  let started = false;
  for (let node = row.firstChild; node !== null; node = node.nextSibling) {
    if (node.name === "TableCell") {
      content = readInline(state, node);
      offset = node.from - tableFrom;
    } else if (node.name === "TableDelimiter") {
      // The "|" a row may start with closes no cell.
      if (started || node.from > row.from) {
        cells.push({ content: content ?? [], offset });
      }
      content = null;
      offset = node.to - tableFrom;
    }
    started = true;
  }
  // A row may end without a "|".
  if (content !== null) cells.push({ content, offset });
  return cells;
}

/** `:---` is left, `---:` is right, `:---:` is centered. */
function readAlign(delimiterRow: string): Align[] {
  return delimiterRow
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => {
      const dashes = cell.trim();
      const left = dashes.startsWith(":");
      const right = dashes.endsWith(":");
      return left && right ? "center" : right ? "right" : left ? "left" : null;
    });
}

/** Elements drawn inside a cell, and the tag each one becomes. */
const INLINE_TAGS: Record<string, string> = {
  StrongEmphasis: "strong",
  Emphasis: "em",
  Strikethrough: "del",
  InlineCode: "code",
  Link: "a",
};

/** Syntax that is not shown: the marks, and the address of a link. */
const HIDDEN = new Set([
  "EmphasisMark",
  "StrikethroughMark",
  "CodeMark",
  "LinkMark",
  "URL",
  "LinkTitle",
]);

function readInline(state: EditorState, node: SyntaxNode): Inline[] {
  const content: Inline[] = [];
  const text = (from: number, to: number) => {
    if (from < to) content.push(state.sliceDoc(from, to));
  };
  let pos = node.from;
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    text(pos, child.from);
    const tag = INLINE_TAGS[child.name];
    if (tag) content.push({ tag, children: readInline(state, child) });
    else if (child.name === "WikiLink") {
      content.push({ tag: "a", children: [wikiLinkLabel(state, child)] });
    }
    // "\|" is how a cell holds a "|": the backslash is not shown.
    else if (child.name === "Escape") text(child.from + 1, child.to);
    else if (!HIDDEN.has(child.name)) text(child.from, child.to);
    pos = child.to;
  }
  text(pos, node.to);
  return content;
}
