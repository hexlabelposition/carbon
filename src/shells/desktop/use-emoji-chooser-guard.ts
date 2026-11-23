import { useEffect } from "react";

/**
 * WebKitGTK opens the emoji chooser of GTK on Ctrl+. and Ctrl+; in any
 * field and in the editor. On a Russian layout the key of "/" types ".",
 * so Ctrl+/ opened it too. This turns the chooser off: a key press the
 * page marks handled is not passed on to GTK. Shortcuts set on these keys
 * still run, their handlers do not look at whether a press was handled.
 * Listens before everything else, so no handler can keep the press from
 * it.
 */
export function useEmojiChooserGuard(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === "." || event.key === ";") event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
