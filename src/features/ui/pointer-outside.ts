import { useEffect } from "react";

/**
 * The DOM event the platform sends on `window` when the window tells that
 * the pointer left it. WebKitGTK does not tell the page on Wayland, and
 * keeps the element the pointer left by hovered: a button in the top row,
 * left by the edge of the window, would stay lit with its tooltip until
 * the pointer comes back.
 */
export const POINTER_LEFT_WINDOW = "carbon:pointerleftwindow";

let outside = false;

/**
 * While the pointer is out of the window, the root element has
 * `data-pointer-outside`, which turns `hover:` off (`index.css`); the
 * next move over the page takes it away.
 */
function setOutside(value: boolean): void {
  if (outside === value) return;
  outside = value;
  if (value) document.documentElement.dataset.pointerOutside = "";
  else delete document.documentElement.dataset.pointerOutside;
}

const leave = () => setOutside(true);
window.addEventListener(POINTER_LEFT_WINDOW, leave);
document.documentElement.addEventListener("mouseleave", leave);
window.addEventListener("pointermove", () => setOutside(false), {
  capture: true,
  passive: true,
});

/** Whether the pointer is out of the window, as far as the page knows. */
export function pointerOutside(): boolean {
  return outside;
}

/**
 * Calls `onLeave` when the pointer leaves the window, while `enabled`:
 * while something is hovered, such as an open tooltip.
 */
export function usePointerLeavesWindow(
  onLeave: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    window.addEventListener(POINTER_LEFT_WINDOW, onLeave);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener(POINTER_LEFT_WINDOW, onLeave);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [onLeave, enabled]);
}
