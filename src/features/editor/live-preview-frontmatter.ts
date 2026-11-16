import { readFrontmatter, type FrontmatterEntry } from "@carbon/core";
import { Prec, StateField, type EditorState } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import { t } from "../i18n/i18n";
import { noteSize } from "./editor-theme";
import { frontmatterEnd } from "./frontmatter-range";

/**
 * Live preview of the frontmatter: drawn as a compact block of keys and
 * values, tags as "#tag", except while the cursor is in it, when it shows
 * its YAML in a monospace font, without Markdown styles. A click on the
 * block puts the cursor in it. YAML that does not parse stays as text, so
 * the mistake can be seen.
 *
 * The cursor at the very start of the note does not open it: a note opens
 * with the cursor there. Like a drawn table, the block replaces lines, so
 * it comes from a state field and does not know whether the editor has
 * the focus.
 */
export const frontmatterPreview = [
  StateField.define<DecorationSet>({
    create: decorate,
    update(decorations, transaction) {
      const changed =
        transaction.docChanged || transaction.selection !== undefined;
      return changed ? decorate(transaction.state) : decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
  }),
  // The up and down keys would step over the block as over one line.
  Prec.high(
    keymap.of([
      { key: "ArrowDown", run: (view) => enter(view, 1) },
      { key: "ArrowUp", run: (view) => enter(view, -1) },
    ]),
  ),
  EditorView.baseTheme({
    ".cm-frontmatter": {
      display: "grid",
      gridTemplateColumns: "minmax(5.5em, max-content) 1fr",
      columnGap: "16px",
      rowGap: "6px",
      padding: "10px 0",
      marginBottom: "8px",
      borderTop: "1px solid var(--cb-line)",
      borderBottom: "1px solid var(--cb-line)",
      fontFamily: "var(--font-sans)",
      fontSize: noteSize(13),
      lineHeight: "1.5",
      cursor: "text",
    },
    ".cm-frontmatter-key": {
      color: "var(--cb-faint)",
      overflowWrap: "anywhere",
    },
    ".cm-frontmatter-value": {
      display: "flex",
      flexWrap: "wrap",
      gap: "4px 6px",
      minWidth: "0",
      color: "var(--cb-muted)",
      overflowWrap: "anywhere",
    },
    ".cm-frontmatter-empty": { color: "var(--cb-faint)" },
    ".cm-frontmatter-chip": {
      padding: "0 7px",
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "999px",
      fontSize: noteSize(12),
    },
    ".cm-frontmatter-tag": { color: "var(--cb-link)" },
    // The YAML while it is edited: none of the Markdown styles the editor
    // gives it, such as a heading for a line above "---".
    ".cm-line.cm-frontmatter-source": {
      fontFamily: "var(--cb-mono-font)",
      fontSize: noteSize(13),
      color: "var(--cb-muted)",
    },
    ".cm-line.cm-frontmatter-source *": {
      font: "inherit",
      color: "inherit",
      textDecoration: "none",
    },
  }),
];

const sourceLine = Decoration.line({ class: "cm-frontmatter-source" });

/** The last YAML read: the cursor moves far more often than it changes. */
let cache: { source: string; read: ReturnType<typeof readFrontmatter> } = {
  source: "",
  read: null,
};

function decorate(state: EditorState): DecorationSet {
  const end = frontmatterEnd(state);
  if (end === null) return Decoration.none;
  const editing = state.selection.ranges.some(
    (range) => range.to > 0 && range.from <= end,
  );
  const source = state.sliceDoc(0, end);
  if (cache.source !== source)
    cache = { source, read: readFrontmatter(source) };

  if (editing || cache.read === null) {
    const lines = [];
    for (let n = 1; n <= state.doc.lineAt(end).number; n++) {
      lines.push(sourceLine.range(state.doc.line(n).from));
    }
    return Decoration.set(lines);
  }
  const widget = new FrontmatterWidget(source, cache.read.entries);
  return Decoration.set(
    Decoration.replace({ widget, block: true }).range(0, end),
  );
}

/**
 * Down from the very start of the note, or up from the line below the
 * block, moves the cursor into its YAML: on its first or last key.
 */
function enter(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view;
  const { main } = state.selection;
  const end = frontmatterEnd(state);
  if (end === null || !main.empty) return false;
  const closing = state.doc.lineAt(end);
  let target: number;
  if (direction === 1 && main.head === 0) {
    target = state.doc.line(Math.min(2, closing.number)).from;
  } else if (
    direction === -1 &&
    state.doc.lineAt(main.head).number === closing.number + 1
  ) {
    target = state.doc.line(Math.max(1, closing.number - 1)).from;
  } else {
    return false;
  }
  view.dispatch({ selection: { anchor: target }, scrollIntoView: true });
  return true;
}

class FrontmatterWidget extends WidgetType {
  constructor(
    /** The YAML of the block: two blocks with equal source are equal. */
    private readonly source: string,
    private readonly entries: readonly FrontmatterEntry[],
  ) {
    super();
  }

  eq(other: FrontmatterWidget): boolean {
    return other.source === this.source;
  }

  toDOM(view: EditorView): HTMLElement {
    const block = document.createElement("div");
    block.className = "cm-frontmatter";
    block.setAttribute("role", "group");
    block.setAttribute("aria-label", t("editor.frontmatter"));
    if (this.entries.length === 0) {
      const empty = block.appendChild(document.createElement("div"));
      empty.className = "cm-frontmatter-empty";
      empty.textContent = t("editor.frontmatterEmpty");
    }
    for (const { key, value } of this.entries) {
      const name = block.appendChild(document.createElement("div"));
      name.className = "cm-frontmatter-key";
      name.textContent = key;
      const shown = block.appendChild(document.createElement("div"));
      shown.className = "cm-frontmatter-value";
      appendValue(shown, value, key === "tags");
    }
    // On press, as for a table: on its first key, or the empty line.
    block.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const { doc } = view.state;
      view.dispatch({
        selection: { anchor: doc.line(Math.min(2, doc.lines)).from },
      });
      view.focus();
    });
    return block;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/** Puts a value in: a list as chips, anything else as text. */
function appendValue(parent: HTMLElement, value: unknown, tags: boolean) {
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0 || (items.length === 1 && isBlank(items[0]))) {
    const blank = parent.appendChild(document.createElement("span"));
    blank.className = "cm-frontmatter-empty";
    blank.textContent = "—";
    return;
  }
  const chips = Array.isArray(value);
  for (const item of items) {
    const span = parent.appendChild(document.createElement("span"));
    if (chips) {
      span.className = tags
        ? "cm-frontmatter-chip cm-frontmatter-tag"
        : "cm-frontmatter-chip";
    }
    span.textContent = (tags ? "#" : "") + textOf(item);
  }
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** A value as text: a mapping or a list inside a list as compact JSON. */
function textOf(value: unknown): string {
  if (isBlank(value)) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
