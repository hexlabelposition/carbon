import { useSyncExternalStore } from "react";

// How many dialogs are open now: the panels of the window wait for none.
const listeners = new Set<() => void>();
let openCount = 0;

/** One more dialog is open (`1`), or one fewer (`-1`). */
export function changeDialogCount(by: number): void {
  openCount += by;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Whether any dialog stands over the window. */
export function useAnyDialogOpen(): boolean {
  return useSyncExternalStore(subscribe, () => openCount > 0);
}
