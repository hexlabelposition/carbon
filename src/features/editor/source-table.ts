import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { noteSize } from "./editor-theme";

/** How wide the fade is on a side of a table with more of it hidden. */
const FADE = 32;

const TABLE_LINE = "cm-source-table";

/**
 * The tables of a note in source mode, shown whole: each row on one line,
 * never wrapped, in the monospace font, so the pipes laid out by the
 * formatter stand in line. A table wider than the note scrolls sideways,
 * all its rows together, and fades out on the side with more of it out
 * of sight, as a table drawn in live preview does. The cursor brings the
 * part of the row it is in into view.
 *
 * CodeMirror draws each line on its own, so the rows cannot share one box
 * that scrolls: each row scrolls by itself, its scroll bar hidden, and a
 * row scrolled, by the wheel or to show the cursor, takes the others of
 * its table along. How far each table is scrolled is kept, by where it
 * starts, for the rows CodeMirror draws again.
 */
export const sourceTables: Extension = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      /** How far each table is scrolled, by where it starts. */
      private scrolled = new Map<number, number>();

      constructor(private readonly view: EditorView) {
        this.decorations = decorate(view);
        this.onScroll = this.onScroll.bind(this);
        // Scrolling does not bubble: caught on the way down instead.
        view.contentDOM.addEventListener("scroll", this.onScroll, true);
        this.sync(false);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          const moved = new Map<number, number>();
          for (const [from, left] of this.scrolled) {
            moved.set(update.changes.mapPos(from), left);
          }
          this.scrolled = moved;
        }
        if (
          update.docChanged ||
          update.viewportChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = decorate(update.view);
        }
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.geometryChanged ||
          update.selectionSet ||
          update.focusChanged
        ) {
          this.sync(update.selectionSet || update.docChanged);
        }
      }

      destroy() {
        this.view.contentDOM.removeEventListener("scroll", this.onScroll, true);
      }

      /** A row scrolled: its table goes along. */
      private onScroll(event: Event) {
        const row = event.target;
        if (!(row instanceof HTMLElement)) return;
        if (!row.classList.contains(TABLE_LINE)) return;
        const table = Number(row.dataset.table);
        this.scrolled.set(table, row.scrollLeft);
        this.apply(table, row.scrollLeft);
      }

      /**
       * Puts every row drawn at the scroll of its table, the rows drawn
       * anew too, and with `reveal` scrolls the table of the cursor so
       * the cursor is out of the fades.
       */
      private sync(reveal: boolean) {
        this.view.requestMeasure({
          key: this,
          read: (view) => {
            if (!reveal) return null;
            const head = view.state.selection.main.head;
            const row = rowAt(view, head);
            const at = view.coordsAtPos(head);
            if (row === null || at === null) return null;
            const box = row.getBoundingClientRect();
            let left = row.scrollLeft;
            if (at.left < box.left + FADE) left -= box.left + FADE - at.left;
            else if (at.right > box.right - FADE) {
              left += at.right - (box.right - FADE);
            }
            return {
              table: Number(row.dataset.table),
              left: Math.max(0, left),
            };
          },
          write: (shown) => {
            if (shown !== null) this.scrolled.set(shown.table, shown.left);
            const tables = new Set<number>();
            for (const row of this.rows())
              tables.add(Number(row.dataset.table));
            for (const table of tables) {
              this.apply(table, this.scrolled.get(table) ?? 0);
            }
          },
        });
      }

      /** Scrolls the rows of `table` to `left`, and marks their fades. */
      private apply(table: number, left: number) {
        const rows = this.rows().filter(
          (row) => Number(row.dataset.table) === table,
        );
        let widest = 0;
        for (const row of rows) {
          if (row.scrollLeft !== left) row.scrollLeft = left;
          widest = Math.max(widest, row.scrollWidth - row.clientWidth);
        }
        // The table's, not each row's: a short row fades as the others.
        for (const row of rows) {
          row.toggleAttribute("data-more-left", left > 1);
          row.toggleAttribute("data-more-right", widest - left > 1);
        }
      }

      private rows(): HTMLElement[] {
        return [
          ...this.view.contentDOM.querySelectorAll<HTMLElement>(
            `.${TABLE_LINE}`,
          ),
        ];
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.baseTheme({
    [`.cm-line.${TABLE_LINE}`]: {
      fontFamily: "var(--cb-mono-font)",
      fontSize: noteSize(13),
      // Whole, not wrapped: the row scrolls instead, without a bar of its
      // own; the wheel with Shift, or sideways on a touchpad, scrolls it.
      whiteSpace: "pre",
      overflowWrap: "normal",
      wordBreak: "normal",
      overflowX: "auto",
      overflowY: "hidden",
      scrollbarWidth: "none",
      "--cm-fade-left": "0px",
      "--cm-fade-right": "0px",
      maskImage:
        "linear-gradient(to right, transparent, #000 var(--cm-fade-left), #000 calc(100% - var(--cm-fade-right)), transparent)",
      WebkitMaskImage:
        "linear-gradient(to right, transparent, #000 var(--cm-fade-left), #000 calc(100% - var(--cm-fade-right)), transparent)",
    },
    [`.cm-line.${TABLE_LINE}::-webkit-scrollbar`]: { display: "none" },
    [`.cm-line.${TABLE_LINE}[data-more-left]`]: {
      "--cm-fade-left": `${FADE}px`,
    },
    [`.cm-line.${TABLE_LINE}[data-more-right]`]: {
      "--cm-fade-right": `${FADE}px`,
    },
  }),
];

/** The row of a table drawn at `pos`, if it is in one. */
function rowAt(view: EditorView, pos: number): HTMLElement | null {
  const { node } = view.domAtPos(pos);
  const element = node instanceof HTMLElement ? node : node.parentElement;
  return element?.closest<HTMLElement>(`.${TABLE_LINE}`) ?? null;
}

/** Each line of a table in view, marked with where its table starts. */
function decorate(view: EditorView): DecorationSet {
  const { state } = view;
  const builder = new RangeSetBuilder<Decoration>();
  let last = -1;
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "Table") return;
        const mark = Decoration.line({
          class: TABLE_LINE,
          attributes: { "data-table": String(node.from) },
        });
        let line = state.doc.lineAt(node.from);
        for (;;) {
          if (line.from > last) {
            builder.add(line.from, line.from, mark);
            last = line.from;
          }
          if (line.to >= node.to || line.number === state.doc.lines) break;
          line = state.doc.line(line.number + 1);
        }
        return false;
      },
    });
  }
  return builder.finish();
}
