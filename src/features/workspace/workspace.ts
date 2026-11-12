import type { NotePath } from "@carbon/core";
import { createContext, useContext } from "react";

/** A tab as the UI shows it. */
export interface TabInfo {
  id: number;
  /** The note the tab shows. */
  path: NotePath;
}

/**
 * The notes that are open in a vault: tabs, each with its own back and
 * forward history, and the one note that is shown.
 */
export interface Workspace {
  /** The note that is shown: the note of the active tab. `null` if none. */
  path: NotePath | null;
  tabs: readonly TabInfo[];
  activeTabId: number | null;
  canGoBack: boolean;
  canGoForward: boolean;

  /**
   * Shows a note: in the active tab, where it becomes the next step of the
   * tab's history, or in a new tab. If a tab already shows the note, that
   * tab is activated instead.
   */
  open(path: NotePath, options?: { newTab?: boolean }): void;
  activateTab(id: number): void;
  closeTab(id: number): void;
  /** Moves the active tab one step through its history. */
  back(): void;
  forward(): void;

  /** Tells that a note or folder was moved, so the open notes follow it. */
  moved(from: string, to: string): void;
  /** Tells that a note or folder was deleted: it leaves tabs and history. */
  removed(path: string): void;

  /**
   * The editor registers how to write its unsaved edits. Returns a function
   * that takes the registration back.
   */
  onFlush(flush: () => Promise<void>): () => void;
  /**
   * Writes the unsaved edits of the shown note. Await it before moving,
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
