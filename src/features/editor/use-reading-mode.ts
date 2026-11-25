import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { startModePreference } from "../settings/editor-options";
import { matchesShortcut, useShortcutLabel } from "../shortcuts/shortcuts";

const STORAGE_KEY = "carbon.editor.readingMode";

export interface ReadingMode {
  /** True: notes are shown to read, nothing in them can be changed. */
  on: boolean;
  toggle(): void;
}

/**
 * Whether notes are shown to read: no cursor, no Markdown shown on a
 * click, no typing; tasks can still be ticked. One switch for every note,
 * as source mode, remembered between app starts unless the settings
 * choose the mode to start in. Its shortcut, Ctrl+E (Cmd+E on a Mac) by
 * default, switches it.
 */
export function useReadingMode(): ReadingMode {
  const t = useT();
  const [on, setOn] = useState(load);
  const shortcut = useShortcutLabel("editor.readingMode");

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
          title: t("editor.toggleReading"),
          shortcut,
          run: toggle,
        },
      ],
      [t, toggle, shortcut],
    ),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, "editor.readingMode")) return;
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
  const start = startModePreference.get();
  if (start !== "remember") return start === "reading";
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "false") === true;
  } catch {
    // Nothing saved yet, or not what this version wrote.
    return false;
  }
}
