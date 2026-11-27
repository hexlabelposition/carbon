import type { Extension } from "@codemirror/state";
import {
  BlockType,
  EditorView,
  ViewPlugin,
  layer,
  type BlockInfo,
  type LayerMarker,
  type ViewUpdate,
} from "@codemirror/view";

/** Room between a number and the text, in pixels. */
const GAP = 10;

/** The lines each drawn line of the file took, by where it starts. */
class LineRows {
  /** Visual lines of a line block, by its start: with its end, to drop it. */
  rows = new Map<number, { to: number; count: number }>();
  /** The width and line height the counts were measured at. */
  width = -1;
  lineHeight = -1;
  /** The lines above the drawn part, while nothing above it changes. */
  above: { from: number; count: number } | null = null;

  update(update: ViewUpdate) {
    if (!update.docChanged) return;
    const { changes } = update;
    const next = new Map<number, { to: number; count: number }>();
    for (const [from, entry] of this.rows) {
      if (changes.touchesRange(from, entry.to)) continue;
      next.set(changes.mapPos(from), {
        to: changes.mapPos(entry.to),
        count: entry.count,
      });
    }
    this.rows = next;
    if (this.above !== null && changes.touchesRange(0, this.above.from)) {
      this.above = null;
    }
  }

  /** Forgets every count: the text has a new width or size. */
  clear() {
    this.rows.clear();
    this.above = null;
  }
}

const lineRows = ViewPlugin.fromClass(LineRows);

/** A number at the left of a line as shown. */
class NumberMarker implements LayerMarker {
  constructor(
    readonly n: number,
    readonly left: number,
    readonly top: number,
    readonly height: number,
  ) {}

  draw(): HTMLElement {
    const element = document.createElement("div");
    element.className = "cm-line-number";
    this.place(element);
    return element;
  }

  update(element: HTMLElement): boolean {
    this.place(element);
    return true;
  }

  eq(other: LayerMarker): boolean {
    return (
      other instanceof NumberMarker &&
      other.n === this.n &&
      other.left === this.left &&
      other.top === this.top &&
      other.height === this.height
    );
  }

  private place(element: HTMLElement) {
    element.textContent = String(this.n);
    element.style.left = `${this.left}px`;
    element.style.top = `${this.top}px`;
    element.style.height = `${this.height}px`;
  }
}

/** A visual line: its top and bottom on screen. */
interface Row {
  top: number;
  bottom: number;
}

/**
 * The visual lines of a drawn line of text: its boxes on screen, those
 * that overlap from top to bottom put together, as a word in a bigger font
 * or an image stands in the same line as the text beside it.
 */
function rowsOfLine(line: HTMLElement): Row[] {
  const range = document.createRange();
  range.selectNodeContents(line);
  const boxes = [...range.getClientRects()]
    .filter((box) => box.height > 0)
    .sort((a, b) => a.top - b.top);
  const rows: Row[] = [];
  for (const box of boxes) {
    const last = rows.at(-1);
    // Overlapping by more than a sliver: the same line.
    if (last !== undefined && box.top < last.bottom - 2) {
      last.bottom = Math.max(last.bottom, box.bottom);
    } else {
      rows.push({ top: box.top, bottom: box.bottom });
    }
  }
  if (rows.length > 0) return rows;
  // An empty line: no boxes inside, the line itself is one.
  const box = line.getBoundingClientRect();
  return [{ top: box.top, bottom: box.bottom }];
}

/** The drawn line element at a position, if it is drawn. */
function lineElementAt(view: EditorView, pos: number): HTMLElement | null {
  const { node } = view.domAtPos(pos);
  const element = node instanceof Element ? node : node.parentElement;
  const line = element?.closest<HTMLElement>(".cm-line") ?? null;
  return line !== null && view.contentDOM.contains(line) ? line : null;
}

/** The parts of a line block: its line of text, and widgets in its place. */
function partsOf(block: BlockInfo): readonly BlockInfo[] {
  return Array.isArray(block.type) ? block.type : [block];
}

/** How many visual lines a line block not drawn now is taken to have. */
function guessedRows(view: EditorView, state: LineRows, block: BlockInfo) {
  const known = state.rows.get(block.from);
  if (known !== undefined) return known.count;
  if (partsOf(block).some((part) => part.type !== BlockType.Text)) return 1;
  return Math.max(1, Math.round(block.height / view.defaultLineHeight));
}

function numbersOf(view: EditorView): readonly LayerMarker[] {
  const state = view.plugin(lineRows);
  if (state === null) return [];

  const width = view.contentDOM.clientWidth;
  const { defaultLineHeight } = view;
  if (width !== state.width || defaultLineHeight !== state.lineHeight) {
    state.clear();
    state.width = width;
    state.lineHeight = defaultLineHeight;
  }

  // Where the layer starts on screen, as CodeMirror places its markers.
  const box = view.scrollDOM.getBoundingClientRect();
  const baseLeft = box.left - view.scrollDOM.scrollLeft * view.scaleX;
  const baseTop = box.top - view.scrollDOM.scrollTop * view.scaleY;
  const documentTop = view.documentTop - baseTop;
  const content = view.contentDOM.getBoundingClientRect();
  const padding = parseFloat(getComputedStyle(view.contentDOM).paddingLeft);
  const left = content.left + padding * view.scaleX - GAP - baseLeft;
  // A number stands in the first line-height or so of its line: in the
  // middle of a line of text or a heading, at the top beside an image.
  const most = defaultLineHeight * 1.6;

  const { from } = view.viewport;
  if (state.above?.from !== from) {
    let count = 0;
    for (let pos = 0; pos < from;) {
      const block = view.lineBlockAt(pos);
      count += guessedRows(view, state, block);
      pos = block.to + 1;
    }
    state.above = { from, count };
  }

  const markers: NumberMarker[] = [];
  let n = state.above.count;
  const add = (top: number, height: number) => {
    n++;
    markers.push(new NumberMarker(n, left, top, Math.min(height, most)));
  };
  for (const block of view.viewportLineBlocks) {
    const before = n;
    for (const part of partsOf(block)) {
      const line =
        part.type === BlockType.Text ? lineElementAt(view, part.from) : null;
      if (line === null) {
        // A widget in place of lines, or a line not drawn: one number.
        add(documentTop + part.top, part.height);
        continue;
      }
      for (const row of rowsOfLine(line)) {
        add(row.top - baseTop, row.bottom - row.top);
      }
    }
    state.rows.set(block.from, { to: block.to, count: n - before });
  }
  return markers;
}

/** Whether the numbers may have moved: the text or its layout. */
function changesNumbers(update: ViewUpdate): boolean {
  return (
    update.docChanged ||
    update.viewportChanged ||
    update.geometryChanged ||
    update.heightChanged
  );
}

/**
 * Numbers at the left of the text, one for each line as it is shown, not
 * as it is in the file: a paragraph that wraps onto three lines has three
 * numbers. A table or the properties block, drawn in place of their lines,
 * count as one. Drawn in a layer below the text, so the text keeps its
 * place, in every mode: live preview, source and reading.
 *
 * Only the lines the editor has drawn can be measured. A line drawn once
 * keeps the count measured then (`LineRows`) until it is edited or the
 * text changes width; one never drawn is counted from the height the
 * editor guesses for it, as many lines of the usual height.
 */
export const lineNumbers: Extension = [
  lineRows,
  layer({
    above: false,
    class: "cm-line-numbers",
    update: changesNumbers,
    markers: numbersOf,
  }),
  EditorView.baseTheme({
    ".cm-line-number": {
      position: "absolute",
      display: "flex",
      alignItems: "center",
      // Its right edge where `left` puts it, however many digits.
      transform: "translateX(-100%)",
      fontSize: "0.75em",
      lineHeight: "1",
      fontVariantNumeric: "tabular-nums",
      color: "var(--cb-faint)",
      whiteSpace: "nowrap",
      userSelect: "none",
      pointerEvents: "none",
    },
  }),
];
