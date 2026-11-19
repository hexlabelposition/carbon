import { useEffect } from "react";

/**
 * Tab and Shift+Tab move the focus from one element to the next in a web
 * page; in the app that walks it through buttons and rows it does not
 * mean to be reached that way. This turns it off everywhere. Where Tab
 * does something of its own, as indenting in the editor, the handler
 * there takes the key first and marks it handled, and it is left alone:
 * this listens on the window, after everything else.
 */
export function useTabFocusGuard(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented) return;
      // Ctrl+Tab and the like are shortcuts, not focus moves.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      // A button keeps the focus after a click, and a key pressed then
      // makes the WebView draw its focus ring (`:focus-visible`), as if it
      // had been reached by Tab. Nothing is reached by Tab now: the button
      // lets the focus go instead.
      const focused = document.activeElement;
      if (
        focused instanceof HTMLElement &&
        focused.matches("button, a[href], [role='button']")
      ) {
        focused.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
