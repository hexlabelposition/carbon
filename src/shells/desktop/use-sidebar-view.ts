import { useCallback, useState } from "react";

/**
 * What the sidebar shows, each by its button of the toolbar. Search is a
 * dialog of its own.
 */
export type SidebarView = "files" | "bookmarks" | "tags" | "drafts" | "trash";

export interface SidebarViewState {
  view: SidebarView;
  show(view: SidebarView): void;
}

/** Which view the sidebar shows. */
export function useSidebarView(): SidebarViewState {
  const [view, setView] = useState<SidebarView>("files");
  const show = useCallback((next: SidebarView) => setView(next), []);
  return { view, show };
}
