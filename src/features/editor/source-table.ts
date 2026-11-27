import {
  cursorLineEnd,
  cursorLineStart,
  selectLineEnd,
  selectLineStart,
} from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import {
  Annotation,
  Prec,
  RangeSetBuilder,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { noteSize } from "./editor-theme";
import { FADE, fadeBase, fadeStyles } from "./table-fade";

const TABLE_LINE = "cm-source-table";

/**
 * Set on the transaction that only draws the cursor again after a table
 * scrolled: it is not the cursor moving, so the table stays where it is.
 */
const redrawn = Annotation.define<boolean>();

/** How far a wheel moving by lines, not pixels, scrolls a table a line. */
const WHEEL_LINE = 16;

/**
 * The tables of a note shown as Markdown, in source mode or while one is
 * edited in live preview (`tablePreview` draws the others), shown whole:
 * each row on one line, never wrapped, in the monospace font, so the
 * pipes laid out by the formatter stand in line. A table wider than the
 * note scrolls sideways, all its rows together, and fades out on the
 * side with more of it out of sight, as a table drawn in live preview
 * does. The wheel with Shift, or sideways on a touchpad, scrolls it; the
 * cursor moved, or the text typed, brings the part of the row it is in
 * into view.
 *
 * CodeMirror draws each line on its own, so the rows cannot share one box
 * that scrolls: each row is clipped, and all the rows of a table are set
 * to the same scroll at once, in the same frame. How far each table is
 * scrolled is kept, by where it starts, for the rows CodeMirror draws
 * again. CodeMirror draws the cursor and the selection in a layer of its
 * own, where they were before a row scrolled: once one did, the same
 * selection is set again, which draws them anew (`redrawn`).
 */
export const sourceTables: Extension = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      /** How far each table is scrolled, by where it starts. */
      private scrolled = new Map<number, number>();
      /** A measure is asked for that brings the cursor into view. */
      private revealing = false;
      /** The frame that draws the cursor again, once a table scrolled. */
      private redraw = 0;

      constructor(private readonly view: EditorView) {
        this.decorations = decorate(view);
        this.onScroll = this.onScroll.bind(this);
        this.onWheel = this.onWheel.bind(this);
        // Scrolling does not bubble: caught on the way down instead. The
        // browser may still scroll a row itself, to show where text is
        // typed: its table then goes along.
        view.contentDOM.addEventListener("scroll", this.onScroll, true);
        view.contentDOM.addEventListener("wheel", this.onWheel, {
          passive: false,
        });
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
        const moved =
          update.docChanged ||
          (update.selectionSet &&
            !update.transactions.some((tr) => tr.annotation(redrawn)));
        // Any update may draw the rows again, which takes off the marks of
        // their fades, the one that only draws the cursor anew too: they
        // are put back, without scrolling.
        this.sync(moved);
      }

      destroy() {
        const { contentDOM } = this.view;
        contentDOM.removeEventListener("scroll", this.onScroll, true);
        contentDOM.removeEventListener("wheel", this.onWheel);
        cancelAnimationFrame(this.redraw);
      }

      /** Sideways over a table: it scrolls, not the note. */
      private onWheel(event: WheelEvent) {
        const row = rowOf(event.target);
        if (row === null) return;
        const by =
          event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0;
        if (by === 0) return;
        event.preventDefault();
        const table = Number(row.dataset.table);
        const step = event.deltaMode === 1 ? WHEEL_LINE : 1;
        const from = this.scrolled.get(table) ?? 0;
        if (this.apply(table, from + by * step)) this.redrawCursor();
      }

      /** A row scrolled by the browser: its table goes along. */
      private onScroll(event: Event) {
        const row = rowOf(event.target);
        if (row === null) return;
        const table = Number(row.dataset.table);
        if (row.scrollLeft === this.scrolled.get(table)) return;
        if (this.apply(table, row.scrollLeft)) this.redrawCursor();
      }

      /** Draws the cursor and the selection again, once a frame. */
      private redrawCursor() {
        if (this.redraw !== 0) return;
        this.redraw = requestAnimationFrame(() => {
          this.redraw = 0;
          this.view.dispatch({
            selection: this.view.state.selection,
            annotations: redrawn.of(true),
          });
        });
      }

      /**
       * Puts every row drawn at the scroll of its table, the rows drawn
       * anew too, and with `reveal` scrolls the table of the cursor so
       * the cursor is out of the fades.
       */
      private sync(reveal: boolean) {
        // A measure asked for later replaces this one: it reveals too.
        this.revealing ||= reveal;
        this.view.requestMeasure({
          key: this,
          read: (view) => {
            const clip = cursorClip(view);
            const wanted = this.revealing;
            this.revealing = false;
            if (!wanted) return { clip, shown: null };
            const head = view.state.selection.main.head;
            const row = rowAt(view, head);
            const at = view.coordsAtPos(head);
            if (row === null || at === null) return { clip, shown: null };
            const box = row.getBoundingClientRect();
            let left = row.scrollLeft;
            if (at.left < box.left + FADE) left -= box.left + FADE - at.left;
            else if (at.right > box.right - FADE) {
              left += at.right - (box.right - FADE);
            }
            return { clip, shown: { table: Number(row.dataset.table), left } };
          },
          write: ({ clip, shown }) => {
            const layer =
              this.view.dom.querySelector<HTMLElement>(".cm-cursorLayer");
            if (layer !== null) {
              // A box as tall as the text and as wide as the rows reach,
              // which hides what is past them. Not `overflow-x: clip`:
              // WebKitGTK cut the layer, which has no height, to nothing.
              layer.style.width = clip === null ? "" : `${clip.right}px`;
              layer.style.height = clip === null ? "" : `${clip.height}px`;
              layer.style.overflow = clip === null ? "" : "hidden";
              layer.style.clipPath =
                clip === null ? "" : `inset(0 0 0 ${Math.max(0, clip.left)}px)`;
            }
            let changed = false;
            const tables = new Set<number>();
            for (const row of this.rows()) {
              tables.add(Number(row.dataset.table));
            }
            for (const table of tables) {
              const left =
                shown?.table === table
                  ? shown.left
                  : (this.scrolled.get(table) ?? 0);
              changed = this.apply(table, left) || changed;
            }
            // Not in the middle of the update that measured.
            if (changed) queueMicrotask(() => this.redrawCursor());
          },
        });
      }

      /**
       * Scrolls the rows of `table` to `left`, kept between its start and
       * its end, and marks their fades. Whether any row moved.
       */
      private apply(table: number, left: number): boolean {
        const rows = this.rows().filter(
          (row) => Number(row.dataset.table) === table,
        );
        let widest = 0;
        for (const row of rows) {
          widest = Math.max(widest, row.scrollWidth - row.clientWidth);
        }
        const kept = Math.round(Math.min(widest, Math.max(0, left)));
        this.scrolled.set(table, kept);
        let moved = false;
        for (const row of rows) {
          if (row.scrollLeft !== kept) {
            row.scrollLeft = kept;
            moved = true;
          }
          // The table's, not each row's: a short row fades as the others.
          row.toggleAttribute("data-more-left", kept > 1);
          row.toggleAttribute("data-more-right", widest - kept > 1);
        }
        return moved;
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
  // Home and End go to the start and the end of a row, not of the part of
  // it in sight, as they would on a line the editor wraps.
  Prec.high(
    keymap.of([
      { key: "Home", run: inTable(cursorLineStart) },
      { key: "End", run: inTable(cursorLineEnd) },
      { key: "Shift-Home", run: inTable(selectLineStart) },
      { key: "Shift-End", run: inTable(selectLineEnd) },
    ]),
  ),
  EditorView.baseTheme({
    [`.cm-line.${TABLE_LINE}`]: {
      fontFamily: "var(--cb-mono-font)",
      fontSize: noteSize(13),
      // Whole, not wrapped: clipped, and scrolled with its table by the
      // plugin, which takes the wheel, so without a bar of its own.
      whiteSpace: "pre",
      overflowWrap: "normal",
      wordBreak: "normal",
      overflow: "hidden",
      ...fadeBase(),
      // As wide as the note, whatever the length of the row: a row as wide
      // as its text would widen the whole text of the note with it.
      boxSizing: "border-box",
      width: "0",
      minWidth: "100%",
    },
    ...fadeStyles(
      `.cm-line.${TABLE_LINE}`,
      "[data-more-left]",
      "[data-more-right]",
    ),
  }),
];

/**
 * Where the layer of the cursor is cut while the note has a table in
 * view, from the corner of the layer: at the sides of its rows, so a
 * cursor in the part of a row scrolled out of sight is hidden with it,
 * not drawn beside the note, nor widening it. `null` without a table.
 */
function cursorClip(
  view: EditorView,
): { left: number; right: number; height: number } | null {
  const row = view.contentDOM.querySelector<HTMLElement>(`.${TABLE_LINE}`);
  const layer = view.dom.querySelector<HTMLElement>(".cm-cursorLayer");
  if (row === null || layer === null) return null;
  const box = row.getBoundingClientRect();
  const corner = layer.getBoundingClientRect();
  // A cursor is drawn a pixel or two wide, before the start of a row and
  // past its end: room for it on both sides. Not past the edge of the
  // editor, which it would widen.
  const edge = view.scrollDOM.getBoundingClientRect().right;
  return {
    left: Math.floor(box.left - corner.left) - 2,
    right: Math.floor(Math.min(box.right + 2, edge) - corner.left),
    height: view.scrollDOM.scrollHeight,
  };
}

/** `command`, run only while the cursor is in a table. */
function inTable(
  command: (view: EditorView) => boolean,
): (view: EditorView) => boolean {
  return (view) =>
    isInTable(view.state, view.state.selection.main.head) && command(view);
}

/** Whether `pos` is in a table, as the grammar finds it. */
function isInTable(state: EditorState, pos: number): boolean {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1);
    node !== null;
    node = node.parent
  ) {
    if (node.name === "Table") return true;
  }
  return false;
}

/** The row of a table that `target` is in, if it is in one. */
function rowOf(target: EventTarget | null): HTMLElement | null {
  const element =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  return element?.closest<HTMLElement>(`.${TABLE_LINE}`) ?? null;
}

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
