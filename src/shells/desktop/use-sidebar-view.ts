import { useCallback, useState } from "react";

/** What the sidebar shows. Search is a dialog of its own. */
export type SidebarView = "files" | "bookmarks" | "tags" | "drafts" | "trash";

/**
 * The views of the file explorer, in the order of its tabs: shown by one
 * button of the toolbar, and chosen in a row of tabs above them.
 */
export const EXPLORER_VIEWS = [
  "files",
  "bookmarks",
  "trash",
] as const satisfies readonly SidebarView[];

export type ExplorerView = (typeof EXPLORER_VIEWS)[number];

/** Whether `view` is one of the tabs of the file explorer. */
export function isExplorerView(view: SidebarView): view is ExplorerView {
  return (EXPLORER_VIEWS as readonly SidebarView[]).includes(view);
}

export interface SidebarViewState {
  view: SidebarView;
  /** The tab of the file explorer shown last, to come back to. */
  explorer: ExplorerView;
  show(view: SidebarView): void;
}

/** Which view the sidebar shows. */
export function useSidebarView(): SidebarViewState {
  const [view, setView] = useState<SidebarView>("files");
  const [explorer, setExplorer] = useState<ExplorerView>("files");
  const show = useCallback((next: SidebarView) => {
    setView(next);
    if (isExplorerView(next)) setExplorer(next);
  }, []);
  return { view, explorer, show };
}
