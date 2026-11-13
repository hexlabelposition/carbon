import { useCallback, useEffect, useState } from "react";

export interface SidePanelState {
  open: boolean;
  toggle(): void;
}

/**
 * Whether a panel beside the note is shown, remembered between app
 * starts under `storageKey`.
 */
export function useSidePanel(storageKey: string): SidePanelState {
  const [open, setOpen] = useState(() => load(storageKey));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(open));
    } catch {
      // Without storage the panel works, it only forgets whether it is open.
    }
  }, [storageKey, open]);

  const toggle = useCallback(() => setOpen((value) => !value), []);
  return { open, toggle };
}

function load(storageKey: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "false") === true;
  } catch {
    // Nothing saved yet, or not what this version wrote.
    return false;
  }
}
