import { useSyncExternalStore } from "react";
import type { TreeScope } from "./use-file-tree";

/** What the button that opens or closes all the folders of a tree shows. */
export interface TreeFolds {
  /** Whether the tree has a folder at all: without one it does nothing. */
  hasFolders: boolean;
  /** Whether a folder is open: then the button closes them all. */
  anyOpen: boolean;
}

const NONE: TreeFolds = { hasFolders: false, anyOpen: false };

const states = new Map<TreeScope, TreeFolds>();
const setters = new Map<TreeScope, (open: boolean) => void>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed() {
  for (const listener of listeners) listener();
}

/**
 * The folds of each mounted tree, by its scope: the tree (`FileTree`)
 * tells them, and the button above it (`TreeFoldButton`), which is not
 * inside the tree, reads them and opens or closes all the folders.
 */
export const treeFolds = {
  /** From the tree, on each render; tells the button only of a change. */
  publish(
    scope: TreeScope,
    state: TreeFolds,
    setAll: (open: boolean) => void,
  ): void {
    setters.set(scope, setAll);
    const old = states.get(scope);
    if (old?.hasFolders === state.hasFolders && old.anyOpen === state.anyOpen) {
      return;
    }
    states.set(scope, state);
    changed();
  },
  /** From the tree when it goes away. */
  withdraw(scope: TreeScope): void {
    setters.delete(scope);
    if (states.delete(scope)) changed();
  },
  /** Opens every folder of the tree of `scope` (`true`), or closes them. */
  setAll(scope: TreeScope, open: boolean): void {
    setters.get(scope)?.(open);
  },
  use(scope: TreeScope): TreeFolds {
    return useSyncExternalStore(subscribe, () => states.get(scope) ?? NONE);
  },
};
