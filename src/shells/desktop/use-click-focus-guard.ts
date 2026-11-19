import { useEffect } from "react";

/** What a press of the mouse does not give the focus to. */
const NO_FOCUS_ON_PRESS = "button, a[href], [role='button']";

/**
 * A button pressed with the mouse keeps the focus where it was, in the note
 * or a field, as the rows of the outline do. Given to the button, a key
 * pressed next, Escape say, would make the WebView draw its focus ring on
 * it (`:focus-visible`), as if it had been reached by Tab, which moves no
 * focus in the app (`useTabFocusGuard`). The click itself still happens.
 */
export function useClickFocusGuard(): void {
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      if (event.target.closest(NO_FOCUS_ON_PRESS) === null) return;
      event.preventDefault();
    };
    // Capture: before a handler of the page stops the event.
    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, []);
}
