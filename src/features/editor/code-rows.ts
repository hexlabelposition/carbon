import { StateEffect, StateField } from "@codemirror/state";
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import { rowsOfLine } from "./line-numbers";

/** How many visual lines each line of code takes, by where it starts. */
type Rows = ReadonlyMap<number, number>;

/** New counts of visual lines, measured, for the lines drawn. */
export const setCodeRows = StateEffect.define<Rows>();

/**
 * How many visual lines each line of a code block takes, a long one
 * wrapped onto several, by where the line starts: measured once it is
 * drawn, and kept, moved with the text, for the numbers of the block
 * (`decorateCodeBlock`), which count the lines as they are shown. A line
 * not measured yet is taken as one.
 */
export const codeRows = StateField.define<Rows>({
  create: () => new Map(),
  update(rows, transaction) {
    let next = rows;
    if (transaction.docChanged) {
      const moved = new Map<number, number>();
      for (const [from, count] of rows) {
        moved.set(transaction.changes.mapPos(from), count);
      }
      next = moved;
    }
    for (const effect of transaction.effects) {
      if (!effect.is(setCodeRows)) continue;
      const merged = new Map(next);
      for (const [from, count] of effect.value) merged.set(from, count);
      next = merged;
    }
    return next;
  },
});

/** The visual lines of a line of code, as it is drawn now. */
export function rowsAt(rows: Rows, from: number): number {
  return rows.get(from) ?? 1;
}

/**
 * Measures the lines of code drawn, as the text, the view or its width
 * changes, and tells `codeRows` when a count is new: the numbers of the
 * block are then drawn anew. Drawing them does not change the height of
 * the lines, so it ends there.
 */
export const measureCodeRows = ViewPlugin.fromClass(
  class {
    constructor(private readonly view: EditorView) {
      this.measure();
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged
      ) {
        this.measure();
      }
    }

    private measure() {
      this.view.requestMeasure({
        key: this,
        read: (view) => {
          const known = view.state.field(codeRows, false);
          if (known === undefined) return null;
          const changed = new Map<number, number>();
          for (const line of view.contentDOM.querySelectorAll<HTMLElement>(
            ".cm-line.cm-code-line",
          )) {
            const from = view.posAtDOM(line, 0);
            const count = rowsOfLine(line).length;
            if (rowsAt(known, from) !== count) changed.set(from, count);
          }
          return changed.size > 0 ? changed : null;
        },
        write: (changed, view) => {
          if (changed === null) return;
          // Not in the middle of the update that measured.
          queueMicrotask(() =>
            view.dispatch({ effects: setCodeRows.of(changed) }),
          );
        },
      });
    }
  },
);
