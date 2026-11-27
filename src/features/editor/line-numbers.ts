import type { Extension } from "@codemirror/state";
import {
  BlockType,
  EditorView,
  ViewPlugin,
  type BlockInfo,
  type ViewUpdate,
} from "@codemirror/view";
import { scrollParentOf } from "./glide";

/** Room in the strip left of the numbers, in pixels. */
const PAD_LEFT = 16;

/** Room in the strip right of the numbers, in pixels. */
const PAD_RIGHT = 12;

/** The fewest digits the strip makes room for, so it does not jump at 10. */
const MIN_DIGITS = 2;

/** The size of a number beside the note text. */
const NUMBER_SIZE = 0.75;

/** How wide a digit is beside its size, about, in the fonts of notes. */
const DIGIT_WIDTH = 0.62;

/** What the layer draws: the numbers, and how wide the strip is. */
interface Measured {
  numbers: Drawn[];
  /** The width of the strip, in pixels. */
  strip: number;
}

/** A number as drawn: where its right edge, top and height are. */
interface Drawn {
  n: number;
  /** The empty line after the last line break, dimmed as in VS Code. */
  final: boolean;
  left: number;
  top: number;
  height: number;
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
function guessedRows(
  view: EditorView,
  rows: ReadonlyMap<number, { count: number }>,
  block: BlockInfo,
) {
  const known = rows.get(block.from);
  if (known !== undefined) return known.count;
  if (partsOf(block).some((part) => part.type !== BlockType.Text)) return 1;
  return Math.max(1, Math.round(block.height / view.defaultLineHeight));
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
 * The numbers of an editor: the counts of its lines, the layer below the
 * text they are drawn in, and the strip at the left edge of the element
 * the note scrolls in, which they stand on.
 */
class LineNumbersView {
  /** Visual lines of a line block, by its start: with its end, to drop it. */
  rows = new Map<number, { to: number; count: number }>();
  /** The width and line height the counts were measured at. */
  width = -1;
  lineHeight = -1;
  /** The lines above the drawn part, while nothing above it changes. */
  above: { from: number; count: number } | null = null;

  readonly dom: HTMLElement;
  private drawn: Drawn[] = [];
  private scale = { x: 1, y: 1 };
  /** The element the note scrolls in, which shows the strip. */
  private host: HTMLElement | null = null;
  /** The width of the strip on it now, in pixels. */
  private strip = 0;
  private readonly observer: ResizeObserver;
  private readonly measureRequest = {
    key: this,
    read: () => this.measure(),
    write: (measured: Measured) => this.draw(measured),
  };

  constructor(readonly view: EditorView) {
    this.dom = view.scrollDOM.appendChild(document.createElement("div"));
    this.dom.className = "cm-layer cm-line-numbers";
    this.dom.setAttribute("aria-hidden", "true");
    // As CodeMirror puts a layer below the text.
    this.dom.style.zIndex = "-1";
    // A change of width rewraps the text at once, but the editor measures
    // it a frame later: the numbers lagged behind the text while a panel
    // slid or the window was resized. Drawn anew as the layout settles,
    // before the frame is painted.
    this.observer = new ResizeObserver(() => this.draw(this.measure()));
    this.observer.observe(view.contentDOM);
    this.observer.observe(view.scrollDOM);
    view.requestMeasure(this.measureRequest);
  }

  update(update: ViewUpdate) {
    if (update.docChanged) {
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
    if (changesNumbers(update)) this.view.requestMeasure(this.measureRequest);
  }

  /** The lines drawn anew, as live preview shows or hides marks. */
  docViewUpdate() {
    this.view.requestMeasure(this.measureRequest);
  }

  /** Forgets every count: the text has a new width or size. */
  clear() {
    this.rows.clear();
    this.above = null;
  }

  /** Where the numbers go now. Reads the layout only. */
  measure(): Measured {
    const { view } = this;
    this.host ??= scrollParentOf(view.dom);

    const width = view.contentDOM.clientWidth;
    const { defaultLineHeight } = view;
    if (width !== this.width || defaultLineHeight !== this.lineHeight) {
      this.clear();
      this.width = width;
      this.lineHeight = defaultLineHeight;
    }

    // Where the layer starts on screen, as CodeMirror places its markers.
    const box = view.scrollDOM.getBoundingClientRect();
    const baseLeft = box.left - view.scrollDOM.scrollLeft * view.scaleX;
    const baseTop = box.top - view.scrollDOM.scrollTop * view.scaleY;
    const documentTop = view.documentTop - baseTop;
    // A number stands in the first line-height or so of its line: in the
    // middle of a line of text or a heading, at the top beside an image.
    const most = defaultLineHeight * 1.6;

    const { from } = view.viewport;
    if (this.above?.from !== from) {
      let count = 0;
      for (let pos = 0; pos < from;) {
        const block = view.lineBlockAt(pos);
        count += guessedRows(view, this.rows, block);
        pos = block.to + 1;
      }
      this.above = { from, count };
    }

    const rows: { top: number; height: number; final: boolean }[] = [];
    let n = this.above.count;
    const add = (top: number, height: number, final = false) => {
      n++;
      rows.push({ top, height: Math.min(height, most), final });
    };
    const { doc } = view.state;
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
        // The text ends with a line break: the empty line after it.
        const final =
          doc.lines > 1 && part.from === doc.length && part.to === doc.length;
        for (const row of rowsOfLine(line)) {
          add(row.top - baseTop, row.bottom - row.top, final);
        }
      }
      this.rows.set(block.from, { to: block.to, count: n - before });
    }

    // As wide as the biggest number of the note: the last one, guessed
    // from the height below what is drawn when that is not drawn.
    const last = view.viewportLineBlocks.at(-1);
    const end = view.lineBlockAt(doc.length).bottom;
    const below =
      last === undefined ? 0 : (end - last.bottom) / defaultLineHeight;
    const digits = Math.max(MIN_DIGITS, String(n + Math.round(below)).length);
    const size = parseFloat(getComputedStyle(view.scrollDOM).fontSize);
    const strip = Math.ceil(
      PAD_LEFT + digits * size * NUMBER_SIZE * DIGIT_WIDTH + PAD_RIGHT,
    );

    // On the strip, at the left edge of the element the note scrolls in.
    const hostLeft = this.host?.getBoundingClientRect().left ?? box.left;
    const left = hostLeft + (strip - PAD_RIGHT) * view.scaleX - baseLeft;
    const first = n - rows.length;
    const numbers = rows.map((row, i) => ({ n: first + i + 1, left, ...row }));
    return { numbers, strip };
  }

  /** Puts the numbers where `measure` found them. Writes only. */
  draw({ numbers, strip }: Measured) {
    const { scaleX, scaleY } = this.view;
    if (scaleX !== this.scale.x || scaleY !== this.scale.y) {
      this.scale = { x: scaleX, y: scaleY };
      this.dom.style.transform = `scale(${1 / scaleX}, ${1 / scaleY})`;
    }
    if (strip !== this.strip && this.host !== null) {
      this.strip = strip;
      showStrip(this.host, strip);
    }
    const elements = this.dom.children;
    numbers.forEach((number, i) => {
      let element = elements[i] as HTMLElement | undefined;
      if (element === undefined) {
        element = this.dom.appendChild(document.createElement("div"));
        element.className = "cm-line-number";
      }
      const old = this.drawn[i];
      if (old?.n !== number.n) element.textContent = String(number.n);
      if (old?.final !== number.final) {
        element.classList.toggle("cm-line-number-final", number.final);
      }
      if (old?.left !== number.left) element.style.left = `${number.left}px`;
      if (old?.top !== number.top) element.style.top = `${number.top}px`;
      if (old?.height !== number.height) {
        element.style.height = `${number.height}px`;
      }
    });
    while (elements.length > numbers.length) this.dom.lastChild!.remove();
    this.drawn = numbers;
  }

  destroy() {
    this.observer.disconnect();
    this.dom.remove();
    if (this.host !== null) showStrip(this.host, 0);
  }
}

/**
 * Shows the strip of the numbers at the left edge of the element a note
 * scrolls in, or takes it away with a width of 0. Painted as its
 * background, which stays put as it scrolls, so the strip runs down the
 * whole height, the name above the text too; its padding keeps what is
 * inside out of the strip, so the note stands in the middle of the room
 * beside it and keeps its width. A line along its right edge, as along
 * the panels of the app.
 */
function showStrip(host: HTMLElement, width: number): void {
  if (width === 0) {
    host.style.removeProperty("padding-left");
    host.style.removeProperty("background-image");
    return;
  }
  host.style.paddingLeft = `${width}px`;
  host.style.backgroundImage = `linear-gradient(to right, var(--cb-panel) ${
    width - 1
  }px, var(--cb-line) ${width - 1}px ${width}px, transparent ${width}px)`;
}

/**
 * Numbers at the left of the text, one for each line as it is shown, not
 * as it is in the file: a paragraph that wraps onto three lines has three
 * numbers. A table or the properties block, drawn in place of their lines,
 * count as one. They stand on a strip at the left edge of the note, as in
 * VS Code, as wide as the biggest number needs (`showStrip`); the text
 * keeps its width. In every mode: live preview, source and reading.
 *
 * Only the lines the editor has drawn can be measured. A line drawn once
 * keeps the count measured then until it is edited or the text changes
 * width; one never drawn is counted from the height the editor guesses
 * for it, as many lines of the usual height.
 */
export const lineNumbers: Extension = [
  ViewPlugin.fromClass(LineNumbersView),
  EditorView.baseTheme({
    ".cm-line-number": {
      position: "absolute",
      display: "flex",
      alignItems: "center",
      // Its right edge where `left` puts it, however many digits.
      transform: "translateX(-100%)",
      fontSize: `${NUMBER_SIZE}em`,
      lineHeight: "1",
      fontVariantNumeric: "tabular-nums",
      color: "var(--cb-faint)",
      whiteSpace: "nowrap",
      userSelect: "none",
      pointerEvents: "none",
    },
    ".cm-line-number-final": { opacity: "0.5" },
  }),
];
