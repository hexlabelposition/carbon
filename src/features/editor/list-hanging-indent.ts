import { syntaxTree } from "@codemirror/language";
import {
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

/** The width before the text of each list line, in pixels, by line start. */
type Hangs = ReadonlyMap<number, number>;

const setHangs = StateEffect.define<Hangs>();

/**
 * A list item that wraps goes on under its text, not under its mark: the
 * line is padded by what stands before the text (the indent, the dot,
 * number or checkbox and the space after it) and its first line is drawn
 * back by as much, so it stays where it was. In every mode.
 *
 * The width is measured on screen, as the marks look different in live
 * preview, source mode and while the cursor shows them: for the lines in
 * view, again after each change that can move them.
 */
export const listHangingIndent: Extension = [
  StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(decorations, tr) {
      let next = decorations.map(tr.changes);
      for (const effect of tr.effects) {
        if (effect.is(setHangs)) next = decorationsOf(effect.value, tr.state);
      }
      return next;
    },
    provide: (field) => EditorView.decorations.from(field),
  }),
  ViewPlugin.fromClass(
    class {
      /** The widths last applied, to tell whether a new measure differs. */
      private applied: Hangs = new Map();

      constructor(private readonly view: EditorView) {
        this.measure();
      }

      update(update: ViewUpdate) {
        if (
          update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(setHangs)),
          )
        ) {
          return;
        }
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.geometryChanged ||
          update.selectionSet ||
          update.focusChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.measure();
        }
      }

      private measure() {
        this.view.requestMeasure({
          key: this,
          read: (view) => measureHangs(view),
          write: (hangs, view) => {
            if (same(hangs, this.applied)) return;
            this.applied = hangs;
            // Not in the middle of the update that measured.
            queueMicrotask(() =>
              view.dispatch({ effects: setHangs.of(hangs) }),
            );
          },
        });
      }
    },
  ),
  EditorView.baseTheme({
    ".cm-line.cm-list-hang": {
      paddingLeft: "var(--cb-hang)",
      textIndent: "calc(-1 * var(--cb-hang))",
    },
    // The indent is inherited: a block inside the line, as the dot of a
    // bullet (an absolute `::after`) or a checkbox, would be drawn back
    // too, away from its place.
    ".cm-line.cm-list-hang *, .cm-line.cm-list-hang *::before, .cm-line.cm-list-hang *::after":
      { textIndent: "0" },
  }),
];

/**
 * How far the text of each list line in view starts from the start of the
 * line. Only lines with nothing but spaces or tabs before the mark: a list
 * in a quote or a callout keeps the padding of its box.
 */
function measureHangs(view: EditorView): Hangs {
  const { state } = view;
  const hangs = new Map<number, number>();
  const { from, to } = view.viewport;
  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      if (node.name !== "ListMark") return;
      const line = state.doc.lineAt(node.from);
      if (hangs.has(line.from)) return;
      if (!/^[ \t]*$/.test(state.sliceDoc(line.from, node.from))) return;
      const marker = node.node.parent?.getChild("Task")?.getChild("TaskMarker");
      let text = marker?.to ?? node.to;
      while (text < line.to && /[ \t]/.test(state.sliceDoc(text, text + 1))) {
        text++;
      }
      if (text >= line.to) return;
      const start = view.coordsAtPos(line.from, 1);
      const end = view.coordsAtPos(text, 1);
      if (start === null || end === null) return;
      const hang = Math.round(end.left - start.left);
      if (hang > 0) hangs.set(line.from, hang);
    },
  });
  return hangs;
}

function decorationsOf(hangs: Hangs, state: EditorState): DecorationSet {
  const ranges = [...hangs]
    .filter(([at]) => at <= state.doc.length)
    .sort(([a], [b]) => a - b)
    .map(([at, hang]) =>
      Decoration.line({
        class: "cm-list-hang",
        attributes: { style: `--cb-hang: ${hang}px` },
      }).range(state.doc.lineAt(at).from),
    );
  return Decoration.set(ranges, true);
}

function same(a: Hangs, b: Hangs): boolean {
  if (a.size !== b.size) return false;
  for (const [at, hang] of a) if (b.get(at) !== hang) return false;
  return true;
}
