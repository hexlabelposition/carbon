/**
 * Moments for measuring the budgets (C-602), as `performance.now()`: from
 * the moment the page began to load. Written once each, read by the line
 * of timings in the sidebar; nothing else depends on them.
 */
export const timing: {
  /** The first frame of the app was drawn: the window shows something. */
  shownAt: number | null;
  /** A vault began to open, last: after a click on the start screen. */
  openedAt: number | null;
} = { shownAt: null, openedAt: null };
