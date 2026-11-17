/**
 * Where the camera of the graph looks: the point of the layout at the
 * middle of the view, and how many CSS pixels one unit of the layout is.
 */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

/** The colors of the graph, from the theme (`readGraphColors`). */
export interface GraphColors {
  node: string;
  /** A note that does not exist. */
  missing: string;
  /** The groups of notes, by folder or tag (`NodeStyle.groups`). */
  groups: readonly string[];
  edge: string;
  /** The note shown in the active pane. */
  current: string;
  label: string;
  background: string;
}

/**
 * A note under the pointer, its neighbors and its links; or the notes of
 * a group, picked in the legend, and the links between them.
 */
export interface Highlight {
  /** The note under the pointer, by index; `null` for a group of notes. */
  node: number | null;
  /** It and the notes it links to or is linked from, by index. */
  nodes: ReadonlySet<number>;
  /** Its links, by their index in `RenderedGraph.edges` / 2. */
  edges: readonly number[];
}

/** How each note is drawn besides its place (C-507). */
export interface NodeStyle {
  /** How many times `NODE_RADIUS` each note is, by index. */
  sizes: Float32Array;
  /** The group of each note, an index into `GraphColors.groups`; -1 none. */
  groups: Int8Array;
}

/** How visible what a highlight leaves out still is, 0 to 1. */
export const FADED = 0.15;

/** What a renderer draws: notes by index, links as pairs of indexes. */
export interface RenderedGraph {
  titles: readonly string[];
  /**
   * 1 for a note that links point to but that does not exist, by index:
   * drawn fainter, as an unresolved link is in a note.
   */
  missing: Uint8Array;
  /** `[source0, target0, source1, target1, ...]`. */
  edges: Uint32Array;
}

/**
 * Draws the graph view (C-503). It only draws: the layout, the camera and
 * what is under the pointer are decided outside, the same for every
 * renderer, so the one C-502 picks can be swapped in.
 */
export interface GraphRenderer {
  /** New positions, `[x0, y0, ...]`, as the layout settles. */
  setPositions(positions: Float32Array): void;
  setCamera(camera: Camera): void;
  /** The note drawn as the current one, by index, or `null`. */
  setCurrent(index: number | null): void;
  /** How big each note is and which group colors it; `null`: all alike. */
  setStyle(style: NodeStyle | null): void;
  /**
   * Draws the notes and links of `highlight` out, the rest faded; all
   * alike for `null`. For a note under the pointer, the titles of it and
   * its neighbors show whatever the zoom; a group may be too many.
   */
  setHighlight(highlight: Highlight | null): void;
  setColors(colors: GraphColors): void;
  /** The container changed size. */
  resize(): void;
  /** Frees the canvas, the GPU memory and the listeners. */
  destroy(): void;
}

export type GraphRendererFactory = (
  container: HTMLElement,
  graph: RenderedGraph,
  positions: Float32Array,
  camera: Camera,
  colors: GraphColors,
  /** Titles show once a note is this wide on screen, in CSS pixels. */
  labelPixels: number,
) => GraphRenderer;

/** Radius of a note, in units of the layout. */
export const NODE_RADIUS = 4;
/** A note is never drawn smaller than this, in CSS pixels. */
export const MIN_NODE_PIXELS = 1.5;
/** From this radius on screen, in CSS pixels, titles are drawn by default. */
export const LABEL_NODE_PIXELS = 5;

/** The colors of the graph in the theme shown now. */
export function readGraphColors(element: Element): GraphColors {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    node: token("--cb-faint"),
    missing: token("--cb-line-strong"),
    groups: [1, 2, 3].map((n) => token(`--cb-group-${n}`)),
    edge: token("--cb-line-strong"),
    // Not the accent: a group color may be close to it. The ink of the
    // text is apart from every group and from the gray of the rest.
    current: token("--cb-fg"),
    label: token("--cb-muted"),
    background: token("--cb-bg"),
  };
}

/**
 * The camera that shows every position in a view of `width` by `height`,
 * the positions taking up `fill` of its shorter side.
 */
export function cameraToFit(
  positions: Float32Array,
  width: number,
  height: number,
  fill = 0.9,
): Camera {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 2) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }
  if (minX > maxX) return { x: 0, y: 0, scale: 1 };
  const span = Math.max(maxX - minX, maxY - minY, NODE_RADIUS * 20);
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    scale: (Math.min(width, height) / span) * fill,
  };
}
