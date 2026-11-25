import { useCallback, useSyncExternalStore } from "react";

/** The dialogs that stand over the window, one at a time. */
export type DialogId =
  | "palette"
  | "switcher"
  | "newNote"
  | "settings"
  | "search"
  | "trashConfirm"
  | "trashPreview"
  | "update"
  | "dev";

// Which dialog is open: anything may open one.
const listeners = new Set<() => void>();
let current: DialogId | null = null;

function set(next: DialogId | null) {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Opens a dialog; the one open before closes. */
export function openDialog(id: DialogId): void {
  set(id);
}

/** The dialog open now, or `null`. */
export function openDialogId(): DialogId | null {
  return current;
}

/** Closes a dialog, if it is the one open. */
export function closeDialog(id: DialogId): void {
  if (current === id) set(null);
}

/**
 * Whether the dialog `id` is open, and a way to open or close it. Only
 * one dialog is open at a time: the command palette, the quick switcher,
 * "New note" and the settings would otherwise stand over each other.
 * Opening one, by its keys or from another, closes the one before.
 */
export function useDialog(id: DialogId): [boolean, (open: boolean) => void] {
  const isOpen = useSyncExternalStore(subscribe, () => current === id);
  const setOpen = useCallback(
    (open: boolean) => (open ? openDialog(id) : closeDialog(id)),
    [id],
  );
  return [isOpen, setOpen];
}
