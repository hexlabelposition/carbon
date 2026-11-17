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
  edge: string;
  /** The note shown in the active pane. */
  current: string;
  label: string;
  background: string;
}

/** What a renderer draws: notes by index, links as pairs of indexes. */
export interface RenderedGraph {
  titles: readonly string[];
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
    edge: token("--cb-line-strong"),
    current: token("--cb-link"),
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
