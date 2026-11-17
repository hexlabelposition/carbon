import { useState } from "react";

/** What the sidebar shows. Search is a dialog of its own. */
export type SidebarView = "files" | "bookmarks" | "tags" | "drafts" | "trash";

export interface SidebarViewState {
  view: SidebarView;
  show(view: SidebarView): void;
}

/** Which view the sidebar shows. */
export function useSidebarView(): SidebarViewState {
  const [view, show] = useState<SidebarView>("files");
  return { view, show };
}
