import { StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { codeAt } from "./code-at";

const selectedLine = Decoration.line({ class: "cm-code-lines-selected" });

/** The lines marked, and whether the selection keeps to them. */
interface Marked {
  decorations: DecorationSet;
  /**
   * The selection is all on the lines marked: the mark alone shows it,
   * not drawn over by the selection itself.
   */
  only: boolean;
}

const none: Marked = { decorations: Decoration.none, only: false };

/**
 * The lines of a code block the selection runs over, one or more, marked
 * whole, from one side of the block to the other: the lines "Copy N lines
 * of code" puts on the clipboard (`codeAt`), so what is seen is what is
 * copied, though the selection itself starts and ends inside a line.
 * Blank lines at either end are marked too, though not copied: the mark
 * runs on as the selection does. On those lines the mark takes the place
 * of the selection, which would be drawn over it, part of a line: the
 * page's selection is not drawn there, and while the menu holds the
 * selection (`heldSelection`), neither is the one the editor draws, if
 * the selection keeps to the lines marked.
 */
export const codeLinesSelected = [
  StateField.define<Marked>({
    create: mark,
    update(marked, transaction) {
      return transaction.docChanged || transaction.selection !== undefined
        ? mark(transaction.state)
        : marked;
    },
    provide: (field) => [
      EditorView.decorations.from(field, (marked) => marked.decorations),
      EditorView.editorAttributes.from(
        field,
        (marked): Record<string, string> =>
          marked.only ? { class: "cm-code-lines-only" } : {},
      ),
    ],
  }),
  EditorView.theme({
    // A tint over the box, whatever its own background, as an added or a
    // removed line has.
    ".cm-line.cm-code-lines-selected": {
      backgroundImage:
        "linear-gradient(color-mix(in srgb, var(--cb-link) 18%, transparent), color-mix(in srgb, var(--cb-link) 18%, transparent))",
    },
    ".cm-content .cm-line.cm-code-lines-selected ::selection, .cm-content .cm-line.cm-code-lines-selected::selection":
      { backgroundColor: "transparent !important" },
    "&.cm-code-lines-only.cb-holding-selection .cm-selectionLayer": {
      display: "none !important",
    },
  }),
];

function mark(state: EditorState): Marked {
  const { main } = state.selection;
  if (main.empty) return none;
  const { doc } = state;
  // From where it starts, or where it ends: it may start before a block.
  const lines =
    codeAt(state, main.from, main)?.lines ??
    codeAt(state, main.to, main)?.lines ??
    null;
  if (lines === null) return none;
  const marks = [];
  for (let number = lines.from; number <= lines.to; number++) {
    marks.push(selectedLine.range(doc.line(number).from));
  }
  return {
    decorations: Decoration.set(marks),
    only:
      main.from >= doc.line(lines.from).from &&
      // Up to the start of the next line, as a selection of whole lines
      // by the mouse ends.
      main.to <= doc.line(lines.to).to + 1,
  };
}
