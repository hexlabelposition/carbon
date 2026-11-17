import { EditorView } from "@codemirror/view";

/** How long a glide takes, in milliseconds. */
const DURATION = 300;

/** The glide running in each scrolling element, to stop it for a new one. */
const running = new WeakMap<HTMLElement, () => void>();

/**
 * Scrolls the note so the line at `pos` stands `margin` pixels below the
 * top of the view, gliding there, then lands exactly with the editor's own
 * `scrollIntoView`.
 *
 * Not CSS `scroll-behavior: smooth`: on a long way the editor measures the
 * lines it passes and sets `scrollTop` to keep its place, and each of
 * those starts a CSS glide anew, which stops short. Here each frame looks
 * where the line is now, so those changes only move the goal, and each
 * frame covers the share of what is left that the easing asks for.
 *
 * At once when the user asks for less motion, or nothing scrolls the note.
 * The wheel, a touchpad or a click on the scrollbar stops a glide.
 */
export function glideTo(view: EditorView, pos: number, margin: number): void {
  const land = () =>
    view.dispatch({
      effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: margin }),
    });
  const scroller = scrollParentOf(view.dom);
  if (
    scroller === null ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    land();
    return;
  }
  running.get(scroller)?.();

  const start = performance.now();
  let done = 0;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    scroller.removeEventListener("wheel", stop);
    scroller.removeEventListener("pointerdown", stop);
    if (running.get(scroller) === stop) running.delete(scroller);
  };
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / DURATION);
    const eased = 1 - (1 - t) ** 3;
    // Where the line is now, from the top of the view.
    const top =
      view.documentTop +
      view.lineBlockAt(pos).top -
      scroller.getBoundingClientRect().top;
    const left = top - margin;
    // The share of what is left that this frame covers, so that the line
    // arrives when `t` reaches 1 however the goal moved on the way.
    const share = done >= 1 ? 1 : (eased - done) / (1 - done);
    done = eased;
    scroller.scrollTop += left * share;
    if (t < 1) frame = requestAnimationFrame(step);
    else {
      stop();
      land();
    }
  };
  running.set(scroller, stop);
  scroller.addEventListener("wheel", stop, { passive: true });
  scroller.addEventListener("pointerdown", stop);
  frame = requestAnimationFrame(step);
}

/** The element that scrolls `element` up and down, if one does. */
export function scrollParentOf(element: HTMLElement): HTMLElement | null {
  for (let at = element.parentElement; at !== null; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);
    if (overflowY === "auto" || overflowY === "scroll") return at;
  }
  return null;
}
