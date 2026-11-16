import { useEffect } from "react";

/**
 * The WebView's own context menu belongs to a browser, not to the app: it
 * offers to reload the page, go back, open or download a link, and, in text
 * fields, input methods and spelling, all of which reach past what the app
 * lets you do. This shuts it everywhere, text fields and the editor among
 * them. The app's own menus, like the file tree's, still open: they handle
 * the event before it reaches the window.
 */
export function useContextMenuGuard(): void {
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);
}
