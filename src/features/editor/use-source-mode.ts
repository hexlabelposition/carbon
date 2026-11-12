import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "carbon.editor.sourceMode";

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

/** The keys that switch source mode, as the user reads them. */
export const SOURCE_MODE_SHORTCUT = isMac ? "Cmd+E" : "Ctrl+E";

export interface SourceMode {
  /** True: notes show their raw Markdown, without live preview. */
  on: boolean;
  toggle(): void;
}

/**
 * Whether notes are shown as raw Markdown. One switch for every note, so
 * a tab that is opened looks like the one before it. Remembered between
 * app starts. Ctrl+E, or Cmd+E on a Mac, switches it.
 */
export function useSourceMode(): SourceMode {
  const [on, setOn] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(on));
    } catch {
      // Without storage the switch works, it only forgets its position.
    }
  }, [on]);

  const toggle = useCallback(() => setOn((value) => !value), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = isMac
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey;
      if (!command || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "e") return;
      event.preventDefault();
      event.stopPropagation();
      toggle();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [toggle]);

  return { on, toggle };
}

function load(): boolean {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "false") === true;
  } catch {
    // Nothing saved yet, or not what this version wrote.
    return false;
  }
}
