// Sizes and room of the parts of the desktop layout, apart from the
// components that draw them, so those refresh on their own while coding.

/**
 * Room to leave at the left end of the top row, under the mark: a square
 * as tall as the row.
 */
export const APP_MARK_ROOM = "pl-bar";

/**
 * Room to leave at the right end of the top row, under the buttons in the
 * top right corner: as wide as they are, which `WindowControls` keeps in
 * `--cb-controls-room` (with the panel buttons or without), less what the
 * right panel covers of them, `--cb-right-panel-cover`. The note area
 * sets that to the width of the right panel while it is open, and the
 * panel sets it back to nothing for its own top row: a panel narrower
 * than the buttons leaves the rest of them over the row beside it.
 */
export const WINDOW_CONTROLS_ROOM =
  "pr-[max(0px,calc(var(--cb-controls-room)_-_var(--cb-right-panel-cover,0px)))]";

/**
 * A side panel dragged narrower than this, in pixels, closes as the drag
 * ends: there is no narrowest width, only the edge it is shut at.
 */
const PANEL_CLOSE_WIDTH = 96;

/** `PANEL_CLOSE_WIDTH` as a share of the window width. */
export function panelCloseFraction(): number {
  return pixelsAsFraction(PANEL_CLOSE_WIDTH);
}

/**
 * The narrowest the notes get between the side panels, in pixels: a side
 * panel has no widest width of its own, it stops this far from the other
 * panel, the toolbar or the edge of the window. So some of the note stays
 * in sight, and the edges of the two panels are never one on another.
 */
const NOTE_MIN_WIDTH = 480;

/** `NOTE_MIN_WIDTH` as a share of the window width. */
export function noteMinFraction(): number {
  return pixelsAsFraction(NOTE_MIN_WIDTH);
}

function pixelsAsFraction(px: number): number {
  const width = document.documentElement.clientWidth;
  return width > 0 ? px / width : 0;
}

/** How wide the toolbar is open: as the mark above it (`w-bar`). */
export const TOOLBAR_WIDTH = "var(--spacing-bar)";

/**
 * The toolbar while `open`, as a share of the window width: `--spacing-bar`
 * is in rem, of the root text size. `0` while it is shut.
 */
export function toolbarFraction(open: boolean): number {
  if (!open) return 0;
  const root = getComputedStyle(document.documentElement);
  const rem = Number.parseFloat(root.getPropertyValue("--spacing-bar"));
  const px = rem * Number.parseFloat(root.fontSize);
  const width = document.documentElement.clientWidth;
  return Number.isFinite(px) && width > 0 ? px / width : 0;
}

/**
 * How wide a side panel is open, as a CSS length: a share of the window
 * (`vw`), but never over the room `besides` (a CSS length: the toolbar,
 * the other panel) leaves it with the narrowest notes beside it. So a
 * window made narrower, or the other panel opened, does not let the
 * panels cover each other. The same for the sidebar and the right panel.
 */
export function panelWidth(fraction: number, besides: string): string {
  return `min(${fraction * 100}vw, calc(100vw - ${besides} - ${NOTE_MIN_WIDTH}px))`;
}
