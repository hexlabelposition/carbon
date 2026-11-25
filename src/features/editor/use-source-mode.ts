import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { startModePreference } from "../settings/editor-options";
import { matchesShortcut, useShortcutLabel } from "../shortcuts/shortcuts";

const STORAGE_KEY = "carbon.editor.sourceMode";

export interface SourceMode {
  /** True: notes show their raw Markdown, without live preview. */
  on: boolean;
  toggle(): void;
}

/**
 * Whether notes are shown as raw Markdown. One switch for every note, so
 * a tab that is opened looks like the one before it. Remembered between
 * app starts, unless the settings choose the mode to start in. Its
 * shortcut has no keys by default; the settings can give it some.
 */
export function useSourceMode(): SourceMode {
  const t = useT();
  const [on, setOn] = useState(load);
  const shortcut = useShortcutLabel("editor.sourceMode");

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
          id: "editor.sourceMode",
          title: t("editor.toggleSource"),
          shortcut,
          run: toggle,
        },
      ],
      [t, toggle, shortcut],
    ),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, "editor.sourceMode")) return;
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
  if (start !== "remember") return start === "source";
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "false") === true;
  } catch {
    // Nothing saved yet, or not what this version wrote.
    return false;
  }
}
