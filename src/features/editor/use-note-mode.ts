import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { startModePreference } from "../settings/editor-options";
import {
  matchesShortcut,
  useShortcutLabel,
  type ShortcutId,
} from "../shortcuts/shortcuts";

/**
 * How notes are shown: as live preview, as their raw Markdown, or to
 * read, where nothing can be typed and only tasks can be ticked.
 */
export type NoteMode = "live" | "source" | "reading";

const STORAGE_KEY = "carbon.editor.mode";
/** Where versions before 0.4 kept the two switches the mode replaced. */
const OLD_SOURCE_KEY = "carbon.editor.sourceMode";
const OLD_READING_KEY = "carbon.editor.readingMode";

export interface NoteModeState {
  mode: NoteMode;
  setMode(mode: NoteMode): void;
}

/**
 * The mode of every note: one for all, so a tab that is opened looks like
 * the one before it. Remembered between app starts, unless the settings
 * choose the mode to start in. The shortcuts of source and reading mode
 * (Ctrl+E for reading by default) switch to their mode, and back to live
 * preview from it.
 */
export function useNoteMode(): NoteModeState {
  const t = useT();
  const [mode, setMode] = useState(load);
  const sourceShortcut = useShortcutLabel("editor.sourceMode");
  const readingShortcut = useShortcutLabel("editor.readingMode");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Without storage the mode works, it only forgets itself.
    }
  }, [mode]);

  const toggle = useCallback((to: NoteMode) => {
    setMode((value) => (value === to ? "live" : to));
  }, []);

  useCommands(
    useMemo(
      () => [
        {
          id: "editor.sourceMode",
          title: t("editor.toggleSource"),
          shortcut: sourceShortcut,
          run: () => toggle("source"),
        },
        {
          id: "editor.readingMode",
          title: t("editor.toggleReading"),
          shortcut: readingShortcut,
          run: () => toggle("reading"),
        },
      ],
      [t, toggle, sourceShortcut, readingShortcut],
    ),
  );

  useEffect(() => {
    const shortcuts: readonly [ShortcutId, NoteMode][] = [
      ["editor.sourceMode", "source"],
      ["editor.readingMode", "reading"],
    ];
    function onKeyDown(event: KeyboardEvent) {
      const hit = shortcuts.find(([id]) => matchesShortcut(event, id));
      if (hit === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      toggle(hit[1]);
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [toggle]);

  return { mode, setMode };
}

function load(): NoteMode {
  const start = startModePreference.get();
  if (start !== "remember") return start;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "live" || stored === "source" || stored === "reading") {
      return stored;
    }
    // What an older version left: reading won over source, as the note
    // could not be typed in then.
    if (localStorage.getItem(OLD_READING_KEY) === "true") return "reading";
    if (localStorage.getItem(OLD_SOURCE_KEY) === "true") return "source";
  } catch {
    // No storage: live preview.
  }
  return "live";
}
