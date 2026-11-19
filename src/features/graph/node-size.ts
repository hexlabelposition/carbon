/*
 * How big a note is drawn, apart from the rest of the styles: the layout
 * worker reads it too, to keep room around big notes, and must not load
 * React.
 */

/** The largest a note gets, in times `NODE_RADIUS`. */
export const MAX_NODE_SIZE = 4;

/**
 * How big a note with `links` links is, in times `NODE_RADIUS`: by the
 * square root, so a hub stands out without hiding its neighbors.
 */
export function sizeFor(links: number): number {
  return Math.min(MAX_NODE_SIZE, 1 + 0.5 * Math.sqrt(links));
}
