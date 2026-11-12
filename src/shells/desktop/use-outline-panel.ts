import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "carbon.desktop.outline";

export interface OutlinePanelState {
  open: boolean;
  toggle(): void;
}

/** Whether the outline panel is shown, remembered between app starts. */
export function useOutlinePanel(): OutlinePanelState {
  const [open, setOpen] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
    } catch {
      // Without storage the panel works, it only forgets whether it is open.
    }
  }, [open]);

  const toggle = useCallback(() => setOpen((value) => !value), []);
  return { open, toggle };
}

function load(): boolean {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "false") === true;
  } catch {
    // Nothing saved yet, or not what this version wrote.
    return false;
  }
}
