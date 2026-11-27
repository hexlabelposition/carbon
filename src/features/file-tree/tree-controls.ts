import { useSyncExternalStore } from "react";
import type { TreeScope } from "./use-file-tree";

/** What the buttons above a tree show of it. */
export interface TreeState {
  /** Whether the tree has a folder at all: without one, none to open. */
  hasFolders: boolean;
  /** Whether a folder is open: then the fold button closes them all. */
  anyOpen: boolean;
}

/** What the buttons above a tree do in it. */
export interface TreeActions {
  /** Opens every folder (`true`), or closes them all. */
  setAllExpanded(open: boolean): void;
  /** Starts typing a name for a new item next to the selection. */
  startNew(what: "note" | "folder"): void;
}

const NONE: TreeState = { hasFolders: false, anyOpen: false };

const states = new Map<TreeScope, TreeState>();
const actions = new Map<TreeScope, TreeActions>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed() {
  for (const listener of listeners) listener();
}

/**
 * Each mounted tree, by its scope, for the buttons above it, which are
 * not inside it: the tree (`FileTree`) tells its state and its actions,
 * the buttons (`TreeNewButtons`, `TreeFoldButton`) read the one and run
 * the other.
 */
export const treeControls = {
  /** From the tree, on each render; tells the buttons only of a change. */
  publish(scope: TreeScope, state: TreeState, does: TreeActions): void {
    actions.set(scope, does);
    const old = states.get(scope);
    if (old?.hasFolders === state.hasFolders && old.anyOpen === state.anyOpen) {
      return;
    }
    states.set(scope, state);
    changed();
  },
  /** From the tree when it goes away. */
  withdraw(scope: TreeScope): void {
    actions.delete(scope);
    if (states.delete(scope)) changed();
  },
  /** The actions of the tree of `scope`, if it is mounted. */
  actions(scope: TreeScope): TreeActions | undefined {
    return actions.get(scope);
  },
  use(scope: TreeScope): TreeState {
    return useSyncExternalStore(subscribe, () => states.get(scope) ?? NONE);
  },
};
