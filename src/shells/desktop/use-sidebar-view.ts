import { useCallback, useEffect, useState } from "react";

/** What the sidebar shows. */
export type SidebarView = "files" | "search";

export interface SidebarViewState {
  view: SidebarView;
  show(view: SidebarView): void;
  /**
   * Grows each time search is asked for, by the shortcut or the tab: the
   * search field takes the focus then.
   */
  searchRequest: number;
}

/**
 * Which view the sidebar shows. Ctrl+Shift+F (Cmd+Shift+F on a Mac) shows
 * search and calls `reveal`, which opens the sidebar if it is collapsed.
 */
export function useSidebarView(
  enabled: boolean,
  reveal: () => void,
): SidebarViewState {
  const [view, setView] = useState<SidebarView>("files");
  const [searchRequest, setSearchRequest] = useState(0);

  const show = useCallback((next: SidebarView) => {
    setView(next);
    if (next === "search") setSearchRequest((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const command = event.ctrlKey || event.metaKey;
      if (!command || !event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "f") return;
      reveal();
      show("search");
      // The editor has uses of its own for some keys.
      event.preventDefault();
      event.stopPropagation();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, reveal, show]);

  return { view, show, searchRequest };
}
