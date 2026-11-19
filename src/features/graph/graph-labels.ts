import {
  MIN_NODE_PIXELS,
  NODE_RADIUS,
  type Camera,
  type GraphColors,
  type Highlight,
  type NodeStyle,
} from "./graph-renderer";

/** A title wraps at this width, in CSS pixels. */
const MAX_WIDTH = 150;
/** A title takes at most this many lines; the last ends in an ellipsis. */
const MAX_LINES = 3;
const FONT_SIZE = 12;
const LINE_HEIGHT = 15;
/** The gap between a note and its title, in CSS pixels. */
const GAP = 4;
/** Titles placed at most in one frame: past that, text costs too much. */
const MAX_LABELS = 400;
/** Notes whose titles are tried at most in one frame, the biggest. */
const MAX_CANDIDATES = 2000;
/** Room kept free around a title, so titles do not touch. */
const PAD = 2;

export interface LabelScene {
  titles: readonly string[];
  positions: Float32Array;
  camera: Camera;
  /** The size of the view, in CSS pixels. */
  width: number;
  height: number;
  style: NodeStyle | null;
  current: number | null;
  colors: GraphColors;
  /** Titles show once a note is this wide on screen, in CSS pixels. */
  labelPixels: number;
  /** What is drawn as highlighted, and how far it has faded in. */
  highlight: Highlight | null;
  fade: number;
  /** How strong what a highlight leaves out is drawn, at full fade. */
  faded: number;
}

/**
 * The titles of the graph, drawn on a canvas of their own over the notes:
 * under each note, centered, wrapped at `MAX_WIDTH` into a few lines. A
 * title that would run into one already placed is left out: those of the
 * note under the pointer and its neighbors go first, then the biggest
 * notes, so the titles never cover each other.
 */
export class GraphLabels {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** The lines of each title, as wrapped with the font of the view. */
  private readonly lines = new Map<string, string[]>();
  private font = "";

  constructor(private readonly container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className =
      "pointer-events-none absolute inset-0 h-full w-full";
    container.append(this.canvas);
    const ctx = this.canvas.getContext("2d");
    if (ctx === null) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
  }

  draw(scene: LabelScene): void {
    const { ctx, canvas } = this;
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(scene.width * ratio);
    const pixelHeight = Math.round(scene.height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const font = `${FONT_SIZE}px ${getComputedStyle(this.container).fontFamily}`;
    if (font !== this.font) {
      this.font = font;
      this.lines.clear();
    }
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const { positions, camera, width, height, titles, style, highlight } =
      scene;
    const { scale } = camera;
    const radiusOf = (i: number) =>
      Math.max(NODE_RADIUS * (style?.sizes[i] ?? 1), MIN_NODE_PIXELS / scale) *
      (i === scene.current ? 1.5 : 1);
    const screenX = (i: number) =>
      (positions[i * 2] - camera.x) * scale + width / 2;
    const screenY = (i: number) =>
      (positions[i * 2 + 1] - camera.y) * scale + height / 2;

    // Titles of the highlight first, its note first of all; then the rest
    // that are big enough on screen, the biggest first.
    const lit = highlight?.node != null ? highlight : null;
    const first: number[] = [];
    if (lit !== null) {
      first.push(lit.node as number);
      for (const i of lit.nodes) if (i !== lit.node) first.push(i);
    }
    const rest: number[] = [];
    for (let i = 0; i < titles.length; i++) {
      if (lit?.nodes.has(i) === true) continue;
      if (radiusOf(i) * scale < scene.labelPixels) continue;
      const x = screenX(i);
      const y = screenY(i);
      if (x < -MAX_WIDTH || x > width + MAX_WIDTH) continue;
      if (y < -MAX_WIDTH || y > height + MAX_WIDTH) continue;
      rest.push(i);
    }
    rest.sort((a, b) => radiusOf(b) - radiusOf(a));
    // The biggest only: placing each title costs a look at those placed.
    if (rest.length > MAX_CANDIDATES) rest.length = MAX_CANDIDATES;

    const placed: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    }[] = [];
    const fits = (box: (typeof placed)[number]) =>
      !placed.some(
        (other) =>
          box.left < other.right &&
          box.right > other.left &&
          box.top < other.bottom &&
          box.bottom > other.top,
      );
    const dim = 1 - (1 - scene.faded) * scene.fade;
    let drawn = 0;
    const place = (i: number, always: boolean) => {
      const lines = this.wrap(titles[i]);
      const x = screenX(i);
      const top = screenY(i) + radiusOf(i) * scale + GAP;
      const halfWidth =
        Math.max(...lines.map((line) => ctx.measureText(line).width)) / 2;
      const box = {
        left: x - halfWidth - PAD,
        right: x + halfWidth + PAD,
        top: top - PAD,
        bottom: top + lines.length * LINE_HEIGHT + PAD,
      };
      if (!always && !fits(box)) return;
      placed.push(box);
      drawn++;
      // What the highlight leaves out fades with the notes.
      ctx.globalAlpha = highlight !== null && !highlight.nodes.has(i) ? dim : 1;
      ctx.fillStyle =
        lit !== null && i === lit.node
          ? scene.colors.current
          : scene.colors.label;
      lines.forEach((line, n) => ctx.fillText(line, x, top + n * LINE_HEIGHT));
    };
    for (const i of first) place(i, true);
    for (const i of rest) {
      if (drawn >= MAX_LABELS) break;
      place(i, false);
    }
    ctx.globalAlpha = 1;
  }

  /** A title in lines of at most `MAX_WIDTH`, cut with an ellipsis. */
  private wrap(title: string): string[] {
    const known = this.lines.get(title);
    if (known !== undefined) return known;
    const { ctx } = this;
    const fitsWidth = (text: string) =>
      ctx.measureText(text).width <= MAX_WIDTH;
    const lines: string[] = [];
    let line = "";
    const words = title.split(/\s+/).filter((word) => word !== "");
    for (let word of words) {
      const tried = line === "" ? word : `${line} ${word}`;
      if (fitsWidth(tried)) {
        line = tried;
        continue;
      }
      if (line !== "") lines.push(line);
      // A word wider than a line is broken where it reaches the edge.
      while (!fitsWidth(word)) {
        let cut = word.length - 1;
        while (cut > 1 && !fitsWidth(word.slice(0, cut))) cut--;
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      line = word;
    }
    if (line !== "") lines.push(line);
    if (lines.length > MAX_LINES) {
      let last = lines[MAX_LINES - 1];
      while (last.length > 1 && !fitsWidth(`${last}…`))
        last = last.slice(0, -1);
      lines.length = MAX_LINES;
      lines[MAX_LINES - 1] = `${last.trimEnd()}…`;
    }
    const result = lines.length === 0 ? [title] : lines;
    this.lines.set(title, result);
    return result;
  }

  destroy(): void {
    this.canvas.remove();
  }
}
