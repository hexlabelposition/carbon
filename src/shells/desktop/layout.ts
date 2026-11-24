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
 * `--cb-controls-room` (with the panel buttons or without).
 */
export const WINDOW_CONTROLS_ROOM = "pr-(--cb-controls-room)";

/**
 * The buttons in the top right corner, as a share of the window width:
 * `--cb-controls-room` over the window. `0` until they are measured.
 */
export function controlsRoomFraction(): number {
  const room = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--cb-controls-room",
    ),
  );
  const width = window.innerWidth;
  return Number.isFinite(room) && width > 0 ? room / width : 0;
}

/** How wide the toolbar is open: as the mark above it (`w-bar`). */
export const TOOLBAR_WIDTH = "var(--spacing-bar)";

/**
 * How wide a side panel is open, as a CSS length: a share of the window
 * (`vw`), never narrower than the buttons in the top right corner, nor
 * than 180 pixels while those fold away over the whole screen. The same
 * for the sidebar and the right panel. Temporary, as `SIDEBAR_MIN`
 * (use-sidebar.ts): the tie to the corner buttons is to be replaced.
 */
export function panelWidth(fraction: number): string {
  return `max(11.25rem, var(--cb-controls-room), ${fraction * 100}vw)`;
}
