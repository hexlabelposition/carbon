import { useCallback, useEffect, useState } from "react";

export interface SidePanelState {
  open: boolean;
  toggle(): void;
  set(open: boolean): void;
}

/**
 * Whether a panel beside the note is shown, remembered between app
 * starts under `storageKey`; `fallback` until something is remembered.
 */
export function useSidePanel(
  storageKey: string,
  fallback = false,
): SidePanelState {
  const [open, setOpen] = useState(() => load(storageKey) ?? fallback);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(open));
    } catch {
      // Without storage the panel works, it only forgets whether it is open.
    }
  }, [storageKey, open]);

  const toggle = useCallback(() => setOpen((value) => !value), []);
  return { open, toggle, set: setOpen };
}

/** What is remembered, or `null` if nothing is, or not what was written. */
function load(storageKey: string): boolean | null {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "null",
    );
    return typeof saved === "boolean" ? saved : null;
  } catch {
    return null;
  }
}
