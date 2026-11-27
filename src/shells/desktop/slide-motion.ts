/**
 * How the side panels and the toolbar slide (`SlidePanel`), and the
 * columns of a split view with them: the time and the curve, one pair to
 * open and one to shut, are in `index.css` (`--cb-slide-*`). The columns
 * take `--cb-slide-duration` and `--cb-slide-ease`, which follow the way
 * the last panel went (`data-slide` on the root element).
 */

/** How long a panel takes to shut: `--cb-slide-close-duration`. */
export const SLIDE_CLOSE_MS = 250;

/**
 * A panel starts to open or to shut: what glides from now on (the columns
 * beside it) takes the time and the curve of that way.
 */
export function setSlideDirection(open: boolean): void {
  document.documentElement.dataset.slide = open ? "open" : "close";
}
