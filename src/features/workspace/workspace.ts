import type { NotePath } from "@carbon/core";
import { createContext, useContext } from "react";
import type { OpenTarget } from "./workspace-state";

export type { OpenTarget };

/** A tab as the UI shows it. */
export interface TabInfo {
  id: number;
  /** The note the tab shows. */
  path: NotePath;
}

/** A pane as the UI shows it. */
export interface PaneInfo {
  /** Stays while the pane does: a key for it. */
  id: number;
  tabs: readonly TabInfo[];
  activeTabId: number | null;
  /** The note the pane shows, `null` if it has no tabs. */
  path: NotePath | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

/** A place in a note to show once the note is open. */
export interface Reveal {
  path: NotePath;
  /** Offset in the text of the note. */
  at: number;
  /** Tells two requests for the same place apart. */
  id: number;
}

/**
 * The notes that are open in a vault: one pane of tabs, or two side by
 * side, each tab with its own back and forward history. One pane is
 * active: the one the user works in.
 */
export interface Workspace {
  /** The note of the active pane. `null` if none. */
  path: NotePath | null;
  /** The tabs of the active pane. */
  tabs: readonly TabInfo[];
  activeTabId: number | null;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Every pane, left to right. */
  panes: readonly PaneInfo[];
  activePane: number;
  /**
   * Where the editor of a note should go, asked for by the last `open`.
   * Any other step through the tabs drops it.
   */
  reveal: Reveal | null;

  /**
   * Shows a note: in the active tab, where it becomes the next step of the
   * tab's history (`here`, the default), in a new tab of the active pane
   * (`newTab`), or in the other pane, made if needed (`beside`). If a tab
   * already shows the note, in either pane, that tab is activated instead.
   * With `at`, the editor goes to that offset of the text.
   */
  open(path: NotePath, options?: { target?: OpenTarget; at?: number }): void;
  activateTab(id: number): void;
  closeTab(id: number): void;
  /** Moves the active tab of the active pane one step through its history. */
  back(): void;
  forward(): void;
  /** Makes a pane the active one. */
  focusPane(index: number): void;

  /** Tells that a note or folder was moved, so the open notes follow it. */
  moved(from: string, to: string): void;
  /** Tells that a note or folder was deleted: it leaves tabs and history. */
  removed(path: string): void;

  /**
   * An editor registers how to write its unsaved edits. Returns a function
   * that takes the registration back.
   */
  onFlush(flush: () => Promise<void>): () => void;
  /**
   * Writes the unsaved edits of the shown notes. Await it before moving,
   * renaming or deleting files, so the edits go to the file they belong to.
   */
  flush(): Promise<void>;
}

export const WorkspaceContext = createContext<Workspace | null>(null);

/** The workspace of the open vault. Needs a `WorkspaceProvider` above. */
export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (workspace === null) {
    throw new Error("useWorkspace needs a WorkspaceProvider above it");
  }
  return workspace;
}
