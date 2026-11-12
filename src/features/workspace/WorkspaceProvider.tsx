import type { NotePath, Vault } from "@carbon/core";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppSettings } from "../settings/app-settings";
import { findNode } from "../vault/paths";
import { WorkspaceContext, type Workspace } from "./workspace";
import {
  activeTab,
  initialWorkspace,
  noteOf,
  workspaceReducer,
} from "./workspace-state";

interface WorkspaceProviderProps {
  vault: Vault;
  /** The note to start with: the one that was shown last time. */
  initial: NotePath | null;
  children: ReactNode;
}

/**
 * Keeps the tabs of one vault and remembers the shown note in the app
 * settings. Mount it with `key={vault.root}`, so each vault starts fresh.
 */
export function WorkspaceProvider({
  vault,
  initial,
  children,
}: WorkspaceProviderProps) {
  const { setLastOpenedNote } = useAppSettings();
  // Only the value at mount counts: later it follows what is saved here.
  const [first] = useState(initial);
  const [state, dispatch] = useReducer(
    workspaceReducer,
    first,
    initialWorkspace,
  );

  const active = activeTab(state);
  const path = active ? noteOf(active) : null;

  useEffect(() => {
    void setLastOpenedNote(vault.root, path);
  }, [vault, path, setLastOpenedNote]);

  useEffect(() => {
    if (first === null) return;
    let cancelled = false;
    // The remembered note may have been deleted while the app was closed.
    vault.tree().then(
      (tree) => {
        const node = findNode(tree, first);
        if (cancelled || (node && node.kind !== "folder")) return;
        dispatch({ type: "removed", path: first });
      },
      () => {},
    );
    // A note deleted by another program while it is shown is handled by its
    // editor, which knows whether there are unsaved edits to rescue.
    return () => {
      cancelled = true;
    };
  }, [vault, first]);

  /** How the mounted editor writes its unsaved edits, if there is one. */
  const flusher = useRef<(() => Promise<void>) | null>(null);

  // These never change, so effects that use them do not run again when the
  // tabs change.
  const actions = useMemo<
    Omit<
      Workspace,
      "path" | "tabs" | "activeTabId" | "canGoBack" | "canGoForward"
    >
  >(
    () => ({
      open: (note, options) =>
        dispatch({
          type: "open",
          path: note,
          newTab: options?.newTab ?? false,
        }),
      activateTab: (id) => dispatch({ type: "activate", id }),
      closeTab: (id) => dispatch({ type: "close", id }),
      back: () => dispatch({ type: "back" }),
      forward: () => dispatch({ type: "forward" }),
      moved: (from, to) => dispatch({ type: "moved", from, to }),
      removed: (removed) => dispatch({ type: "removed", path: removed }),
      onFlush: (flush) => {
        flusher.current = flush;
        return () => {
          if (flusher.current === flush) flusher.current = null;
        };
      },
      flush: () => flusher.current?.() ?? Promise.resolve(),
    }),
    [],
  );

  const workspace = useMemo<Workspace>(
    () => ({
      ...actions,
      path,
      tabs: state.tabs.map((tab) => ({ id: tab.id, path: noteOf(tab) })),
      activeTabId: state.activeId,
      canGoBack: active !== undefined && active.index > 0,
      canGoForward:
        active !== undefined && active.index < active.history.length - 1,
    }),
    [actions, path, state, active],
  );

  return <WorkspaceContext value={workspace}>{children}</WorkspaceContext>;
}
