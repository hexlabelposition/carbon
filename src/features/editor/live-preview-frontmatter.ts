import {
  editFrontmatter,
  propertyValue,
  readFrontmatter,
  type FrontmatterEntry,
  type PropertyEdit,
} from "@carbon/core";
import {
  Prec,
  StateEffect,
  StateField,
  type EditorState,
} from "@codemirror/state";
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

/** A field of the block to open for typing once it is drawn anew. */
type OpenRequest = { kind: "add" } | { kind: "value"; key: string };

const openRequest = StateEffect.define<OpenRequest>();

interface FieldValue {
  decorations: DecorationSet;
  request: OpenRequest | null;
  /** Grows with each request: a widget with an older one is not equal. */
  requestId: number;
}

/**
 * Live preview of the frontmatter, and its properties editor (C-408):
 * drawn as a compact block of keys and values, tags as "#tag", except
 * while the cursor is in it, when it shows its YAML in a monospace font,
 * without Markdown styles. YAML that does not parse stays as text, so
 * the mistake can be seen.
 *
 * In the block a click on a value types a new one (a list as parts apart
 * by commas), a box ticks true or false, a click on a key renames it,
 * and × removes it; "Add property" adds one, "Edit YAML" opens the text.
 * Each change rewrites the YAML through the core (`editFrontmatter`), so
 * it is undone as one step. In reading mode the block is only shown.
 *
 * The cursor at the very start of the note does not open the YAML: a
 * note opens with the cursor there. Like a drawn table, the block
 * replaces lines, so it comes from a state field and does not know
 * whether the editor has the focus.
 */
export const frontmatterPreview = [
  StateField.define<FieldValue>({
    create: (state) => ({
      decorations: decorate(state, null, 0),
      request: null,
      requestId: 0,
    }),
    update(value, transaction) {
      let { request, requestId } = value;
      for (const effect of transaction.effects) {
        if (effect.is(openRequest)) {
          request = effect.value;
          requestId++;
        }
      }
      const changed =
        requestId !== value.requestId ||
        transaction.docChanged ||
        transaction.selection !== undefined ||
        // Reading mode turned on or off.
        transaction.reconfigured;
      if (!changed) return value;
      return {
        decorations: decorate(transaction.state, request, requestId),
        request,
        requestId,
      };
    },
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
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
      gridTemplateColumns: "minmax(5.5em, max-content) 1fr auto",
      columnGap: "16px",
      rowGap: "2px",
      padding: "8px 0",
      marginBottom: "8px",
      borderTop: "1px solid var(--cb-line)",
      borderBottom: "1px solid var(--cb-line)",
      fontFamily: "var(--font-sans)",
      fontSize: noteSize(13),
      lineHeight: "1.5",
      cursor: "text",
    },
    ".cm-frontmatter-row": { display: "contents" },
    ".cm-frontmatter-key, .cm-frontmatter-value": {
      minWidth: "0",
      padding: "2px 4px",
      margin: "0 -4px",
      borderRadius: "4px",
      overflowWrap: "anywhere",
    },
    ".cm-frontmatter-key": { color: "var(--cb-faint)" },
    ".cm-frontmatter-value": {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "4px 6px",
      color: "var(--cb-muted)",
    },
    ".cm-frontmatter-editable": { cursor: "pointer" },
    ".cm-frontmatter-editable:hover": {
      backgroundColor: "var(--cb-raise)",
    },
    ".cm-frontmatter-empty": { color: "var(--cb-faint)" },
    ".cm-frontmatter-chip": {
      padding: "0 7px",
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "999px",
      fontSize: noteSize(12),
    },
    ".cm-frontmatter-tag": { color: "var(--cb-link)" },
    ".cm-frontmatter-input": {
      width: "100%",
      minWidth: "0",
      padding: "0 4px",
      margin: "0 -4px",
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "4px",
      backgroundColor: "var(--cb-bg)",
      color: "var(--cb-fg)",
      font: "inherit",
      outline: "none",
    },
    ".cm-frontmatter-check": {
      margin: "0",
      accentColor: "var(--cb-solid)",
      cursor: "pointer",
    },
    ".cm-frontmatter-remove": {
      alignSelf: "center",
      width: "20px",
      height: "20px",
      padding: "0",
      border: "none",
      borderRadius: "4px",
      background: "none",
      color: "var(--cb-faint)",
      cursor: "pointer",
      opacity: "0",
    },
    ".cm-frontmatter-row:hover .cm-frontmatter-remove, .cm-frontmatter-remove:focus-visible":
      { opacity: "1" },
    ".cm-frontmatter-remove:hover": {
      backgroundColor: "var(--cb-raise)",
      color: "var(--cb-fg)",
    },
    ".cm-frontmatter-actions": {
      gridColumn: "1 / -1",
      display: "flex",
      gap: "12px",
      paddingTop: "4px",
    },
    ".cm-frontmatter-action": {
      padding: "0",
      border: "none",
      background: "none",
      color: "var(--cb-faint)",
      font: "inherit",
      cursor: "pointer",
    },
    ".cm-frontmatter-action:hover": { color: "var(--cb-fg)" },
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

/**
 * Opens a field to add a property, after giving the note an empty
 * frontmatter if it has none. Does nothing while its YAML does not parse.
 */
export function addProperty(view: EditorView): void {
  const { state } = view;
  const end = frontmatterEnd(state);
  if (end !== null && readFrontmatter(state.sliceDoc(0, end)) === null) return;
  view.dispatch({
    changes: end === null ? { from: 0, insert: "---\n---\n" } : undefined,
    // Out of the YAML, if the cursor is in it, so the block is drawn.
    selection: { anchor: 0 },
    effects: openRequest.of({ kind: "add" }),
    scrollIntoView: true,
  });
}

const sourceLine = Decoration.line({ class: "cm-frontmatter-source" });

/** The last YAML read: the cursor moves far more often than it changes. */
let cache: { source: string; read: ReturnType<typeof readFrontmatter> } = {
  source: "",
  read: null,
};

function decorate(
  state: EditorState,
  request: OpenRequest | null,
  requestId: number,
): DecorationSet {
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
  const widget = new FrontmatterWidget({
    source,
    entries: cache.read.entries,
    editable: !state.readOnly,
    request,
    requestId,
  });
  return Decoration.set(
    Decoration.replace({ widget, block: true }).range(0, end),
  );
}

/** Makes `edit` in the frontmatter of the note; then opens `next`. */
function apply(view: EditorView, edit: PropertyEdit, next?: OpenRequest) {
  const end = frontmatterEnd(view.state);
  const change = editFrontmatter(
    end === null ? "" : view.state.sliceDoc(0, end),
    edit,
  );
  if (change === null) return;
  view.dispatch({
    changes: change,
    effects: next === undefined ? [] : openRequest.of(next),
    userEvent: "input",
  });
}

/** Puts the cursor in the YAML, on its first key or the empty line. */
function openSource(view: EditorView) {
  const { doc } = view.state;
  view.dispatch({
    selection: { anchor: doc.line(Math.min(2, doc.lines)).from },
  });
  view.focus();
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

interface WidgetModel {
  /** The YAML of the block. */
  source: string;
  entries: readonly FrontmatterEntry[];
  editable: boolean;
  request: OpenRequest | null;
  requestId: number;
}

class FrontmatterWidget extends WidgetType {
  constructor(private readonly model: WidgetModel) {
    super();
  }

  eq(other: FrontmatterWidget): boolean {
    const a = this.model;
    const b = other.model;
    return (
      a.source === b.source &&
      a.editable === b.editable &&
      a.requestId === b.requestId
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const { entries, editable, request } = this.model;
    const block = document.createElement("div");
    block.className = "cm-frontmatter";
    block.setAttribute("role", "group");
    block.setAttribute("aria-label", t("editor.frontmatter"));

    if (entries.length === 0 && !editable) {
      const empty = block.appendChild(document.createElement("div"));
      empty.className = "cm-frontmatter-empty";
      empty.textContent = t("editor.frontmatterEmpty");
    }
    for (const entry of entries) {
      const row = block.appendChild(document.createElement("div"));
      row.className = "cm-frontmatter-row";
      row.append(
        keyCell(view, entry, editable),
        valueCell(
          view,
          entry,
          editable,
          request?.kind === "value" && request.key === entry.key,
        ),
      );
      row.append(
        editable
          ? removeButton(view, entry.key)
          : document.createElement("span"),
      );
    }
    if (editable) block.append(actions(view, request?.kind === "add"));

    // A press on the block, not on one of its fields: into the YAML.
    block.addEventListener("mousedown", (event) => {
      if (event.target !== block) return;
      event.preventDefault();
      openSource(view);
    });
    return block;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function keyCell(
  view: EditorView,
  { key }: FrontmatterEntry,
  editable: boolean,
): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "cm-frontmatter-key";
  cell.textContent = key;
  if (!editable) return cell;
  cell.classList.add("cm-frontmatter-editable");
  cell.title = t("editor.renameProperty");
  cell.addEventListener("click", (event) => {
    if ((event.target as Element).closest("input") !== null) return;
    cell.replaceChildren(
      textInput({
        label: t("editor.propertyName"),
        initial: key,
        onCommit: (text) => {
          const to = text.trim();
          if (to !== "" && to !== key) {
            apply(view, { kind: "rename", from: key, to });
          }
        },
        onCancel: () => cell.replaceChildren(key),
      }),
    );
  });
  return cell;
}

function valueCell(
  view: EditorView,
  { key, value }: FrontmatterEntry,
  editable: boolean,
  open: boolean,
): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "cm-frontmatter-value";
  if (editable && typeof value === "boolean") {
    const box = cell.appendChild(document.createElement("input"));
    box.type = "checkbox";
    box.className = "cm-frontmatter-check";
    box.checked = value;
    box.setAttribute("aria-label", key);
    box.addEventListener("change", () =>
      apply(view, { kind: "set", key, value: box.checked }),
    );
    return cell;
  }
  appendValue(cell, value, key === "tags");
  // A mapping is no line of text: it is edited in the YAML.
  if (!editable || !isTyped(value)) return cell;

  cell.classList.add("cm-frontmatter-editable");
  const edit = () => {
    cell.replaceChildren(
      textInput({
        label: t("editor.propertyValue", { key }),
        initial: textForInput(value),
        onCommit: (text) => {
          const next = propertyValue(key, text, value);
          if (JSON.stringify(next) !== JSON.stringify(value)) {
            apply(view, { kind: "set", key, value: next });
          } else {
            cell.replaceChildren();
            appendValue(cell, value, key === "tags");
          }
        },
        onCancel: () => {
          cell.replaceChildren();
          appendValue(cell, value, key === "tags");
        },
      }),
    );
  };
  cell.addEventListener("click", (event) => {
    if ((event.target as Element).closest("input") === null) edit();
  });
  if (open) edit();
  return cell;
}

function removeButton(view: EditorView, key: string): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cm-frontmatter-remove";
  button.textContent = "×";
  button.setAttribute("aria-label", t("editor.removeProperty", { key }));
  button.title = t("editor.removeProperty", { key });
  button.addEventListener("click", () => apply(view, { kind: "remove", key }));
  return button;
}

/** "Add property" and "Edit YAML", or the field for the new key. */
function actions(view: EditorView, adding: boolean): HTMLElement {
  const row = document.createElement("div");
  row.className = "cm-frontmatter-actions";
  const add = row.appendChild(document.createElement("button"));
  add.type = "button";
  add.className = "cm-frontmatter-action";
  add.textContent = `+ ${t("editor.addProperty")}`;
  const yaml = row.appendChild(document.createElement("button"));
  yaml.type = "button";
  yaml.className = "cm-frontmatter-action";
  yaml.textContent = t("editor.editYaml");
  yaml.addEventListener("click", () => openSource(view));

  const startAdding = () => {
    const field = textInput({
      label: t("editor.propertyName"),
      initial: "",
      onCommit: (text) => {
        const key = text.trim();
        if (key === "") {
          row.replaceChildren(add, yaml);
          return;
        }
        // An existing key: its value is opened, nothing is added.
        const exists = readFrontmatter(
          view.state.sliceDoc(0, frontmatterEnd(view.state) ?? 0),
        )?.entries.some((entry) => entry.key === key);
        if (exists === true) {
          view.dispatch({ effects: openRequest.of({ kind: "value", key }) });
        } else {
          apply(
            view,
            { kind: "set", key, value: null },
            { kind: "value", key },
          );
        }
      },
      onCancel: () => row.replaceChildren(add, yaml),
    });
    field.placeholder = t("editor.propertyName");
    row.replaceChildren(field);
  };
  add.addEventListener("click", startAdding);
  if (adding) startAdding();
  return row;
}

/**
 * A field that commits on Enter or when it loses the focus, and cancels
 * on Escape. It takes the focus once it is in the page.
 */
function textInput(options: {
  label: string;
  initial: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "cm-frontmatter-input";
  input.value = options.initial;
  input.setAttribute("aria-label", options.label);
  input.spellcheck = false;
  // Committing redraws the block, which takes the field away and blurs
  // it: once is enough.
  let done = false;
  const finish = (commit: boolean) => {
    if (done) return;
    done = true;
    if (commit) options.onCommit(input.value);
    else options.onCancel();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true));
  requestAnimationFrame(() => {
    if (!input.isConnected) return;
    input.focus();
    input.select();
  });
  return input;
}

/** Whether a value can be typed as a line: not a mapping. */
function isTyped(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every((item) => item === null || typeof item !== "object");
  }
  return value === null || value === undefined || typeof value !== "object";
}

/** A value as it is typed: a list as its parts apart by commas. */
function textForInput(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  return value === null || value === undefined ? "" : String(value);
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
