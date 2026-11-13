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
import {
  WorkspaceContext,
  type PaneInfo,
  type Reveal,
  type Workspace,
} from "./workspace";
import {
  initialWorkspace,
  noteOf,
  shownTab,
  workspaceReducer,
  type Pane,
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

  const panes = useMemo(() => state.panes.map(paneInfo), [state.panes]);
  const { path } = panes[state.activePane];

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

  const [reveal, setReveal] = useState<Reveal | null>(null);
  const nextReveal = useRef(1);

  /** How the mounted editors write their unsaved edits. */
  const flushers = useRef(new Set<() => Promise<void>>());

  // These never change, so effects that use them do not run again when the
  // tabs change.
  const actions = useMemo<
    Omit<
      Workspace,
      | "path"
      | "tabs"
      | "activeTabId"
      | "canGoBack"
      | "canGoForward"
      | "panes"
      | "activePane"
      | "reveal"
    >
  >(
    () => ({
      open: (note, options) => {
        const at = options?.at;
        setReveal(
          at === undefined
            ? null
            : { path: note, at, id: nextReveal.current++ },
        );
        dispatch({
          type: "open",
          path: note,
          target: options?.target ?? "here",
        });
      },
      activateTab: (id) => {
        setReveal(null);
        dispatch({ type: "activate", id });
      },
      closeTab: (id) => {
        setReveal(null);
        dispatch({ type: "close", id });
      },
      back: () => {
        setReveal(null);
        dispatch({ type: "back" });
      },
      forward: () => {
        setReveal(null);
        dispatch({ type: "forward" });
      },
      focusPane: (index) => dispatch({ type: "focusPane", index }),
      moved: (from, to) => dispatch({ type: "moved", from, to }),
      removed: (removed) => dispatch({ type: "removed", path: removed }),
      onFlush: (flush) => {
        flushers.current.add(flush);
        return () => {
          flushers.current.delete(flush);
        };
      },
      flush: async () => {
        await Promise.all([...flushers.current].map((flush) => flush()));
      },
    }),
    [],
  );

  const workspace = useMemo<Workspace>(() => {
    const pane = panes[state.activePane];
    return {
      ...actions,
      path: pane.path,
      tabs: pane.tabs,
      activeTabId: pane.activeTabId,
      canGoBack: pane.canGoBack,
      canGoForward: pane.canGoForward,
      panes,
      activePane: state.activePane,
      // For an editor that shows the note, in either pane.
      reveal:
        reveal !== null && panes.some((p) => p.path === reveal.path)
          ? reveal
          : null,
    };
  }, [actions, panes, state.activePane, reveal]);

  return <WorkspaceContext value={workspace}>{children}</WorkspaceContext>;
}

function paneInfo(pane: Pane): PaneInfo {
  const shown = shownTab(pane);
  return {
    id: pane.id,
    tabs: pane.tabs.map((tab) => ({ id: tab.id, path: noteOf(tab) })),
    activeTabId: pane.activeId,
    path: shown ? noteOf(shown) : null,
    canGoBack: shown !== undefined && shown.index > 0,
    canGoForward: shown !== undefined && shown.index < shown.history.length - 1,
  };
}
