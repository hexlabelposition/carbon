import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo } from "react";
import { useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { matchesShortcut, useShortcutLabel } from "../shortcuts/shortcuts";
import { formatNoteText } from "./format-note";

/**
 * Formatting the note of an editor: the button above it, a command of
 * the palette and its shortcut, offered for the note of the active pane
 * while it can be edited. Returns what the button needs.
 */
export function useFormatNote(
  view: () => EditorView | null,
  active: boolean,
  readOnly: boolean,
): { run: () => void; shortcut: string | undefined } {
  const t = useT();
  const shortcut = useShortcutLabel("editor.formatNote");
  const run = useCallback(() => {
    const editor = view();
    if (editor !== null) formatNoteText(editor);
  }, [view]);
  const offered = active && !readOnly;

  useCommands(
    useMemo(
      () =>
        offered
          ? [
              {
                id: "editor.formatNote",
                title: t("editor.formatNote"),
                shortcut,
                run,
              },
            ]
          : [],
      [offered, t, shortcut, run],
    ),
  );

  useEffect(() => {
    if (!offered) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, "editor.formatNote")) return;
      event.preventDefault();
      event.stopPropagation();
      run();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [offered, run]);

  return { run, shortcut };
}
