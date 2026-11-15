import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommands } from "../commands/commands";

const STORAGE_KEY = "carbon.editor.readingMode";

export interface ReadingMode {
  /** True: notes are shown to read, nothing in them can be changed. */
  on: boolean;
  toggle(): void;
}

/**
 * Whether notes are shown to read: no cursor, no Markdown shown on a
 * click, no typing; tasks can still be ticked. One switch for every note,
 * as source mode, remembered between app starts.
 */
export function useReadingMode(): ReadingMode {
  const [on, setOn] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(on));
    } catch {
      // Without storage the switch works, it only forgets its position.
    }
  }, [on]);

  const toggle = useCallback(() => setOn((value) => !value), []);
  useCommands(
    useMemo(
      () => [
        {
          id: "editor.readingMode",
          title: "Toggle reading mode",
          run: toggle,
        },
      ],
      [toggle],
    ),
  );

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
