import { bounds, type BenchGraph, type Positions } from "../graph-data";

/**
 * Where the camera looks: the point of the layout at the middle of the
 * view, and the zoom, 1 showing the whole graph.
 */
export interface View {
  x: number;
  y: number;
  zoom: number;
}

/** One candidate renderer of the graph bench (C-502). */
export interface Renderer {
  /** Draws the graph as seen from `view`, now or in the next frame. */
  setView(view: View): void;
  /** Frees the canvas, the GPU memory and the listeners. */
  destroy(): void;
}

export type RendererFactory = (
  container: HTMLElement,
  graph: BenchGraph,
  positions: Positions,
) => Promise<Renderer>;

/** Node radius and edge width, in layout units and screen pixels. */
export const NODE_RADIUS = 3;
export const NODE_COLOR = 0x9aa0a6;
export const EDGE_COLOR = 0x6b7075;
export const EDGE_ALPHA = 0.35;

/** The middle of the layout and the scale that fits it in `width` by `height`. */
export function fit(positions: Positions, width: number, height: number) {
  const box = bounds(positions);
  const spanX = Math.max(box.maxX - box.minX, 1);
  const spanY = Math.max(box.maxY - box.minY, 1);
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
    span: Math.max(spanX, spanY),
    scale: Math.min(width, height) / Math.max(spanX, spanY),
  };
}

export const css = (color: number, alpha = 1) =>
  `rgba(${color >> 16}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${alpha})`;
