import { StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { codeAt } from "./code-at";

const selectedLine = Decoration.line({ class: "cm-code-lines-selected" });

/**
 * The lines of a code block the selection runs over, when it runs over
 * two or more, marked whole, from one side of the block to the other:
 * the lines "Copy N lines of code" puts on the clipboard (`codeAt`), so
 * what is seen is what is copied, though the selection itself starts and
 * ends inside a line.
 */
export const codeLinesSelected = [
  StateField.define<DecorationSet>({
    create: decorate,
    update(decorations, transaction) {
      return transaction.docChanged || transaction.selection !== undefined
        ? decorate(transaction.state)
        : decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
  }),
  EditorView.baseTheme({
    // A tint over the box, whatever its own background, as an added or a
    // removed line has.
    ".cm-line.cm-code-lines-selected": {
      backgroundImage:
        "linear-gradient(color-mix(in srgb, var(--cb-link) 18%, transparent), color-mix(in srgb, var(--cb-link) 18%, transparent))",
    },
  }),
];

function decorate(state: EditorState): DecorationSet {
  const { main } = state.selection;
  // Most selections are in one line, or none: nothing to look up.
  if (main.empty) return Decoration.none;
  const { doc } = state;
  if (doc.lineAt(main.from).number === doc.lineAt(main.to).number) {
    return Decoration.none;
  }
  // From where it starts, or where it ends: it may start before a block.
  const lines =
    codeAt(state, main.from, main)?.lines ??
    codeAt(state, main.to, main)?.lines ??
    null;
  if (lines === null) return Decoration.none;
  const marks = [];
  for (let number = lines.first; number <= lines.last; number++) {
    marks.push(selectedLine.range(doc.line(number).from));
  }
  return Decoration.set(marks);
}
