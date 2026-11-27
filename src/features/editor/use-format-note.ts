import type { EditorView } from "@codemirror/view";
import { useCallback, useMemo } from "react";
import { keys, useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { formatOnSavePreference } from "../settings/note-style";
import { formatNoteText } from "./format-note";

/**
 * Formatting the note of an editor: the button above it and a command of
 * the palette, offered for the note of the active pane while it can be
 * edited. Ctrl+S formats it too, before it saves it
 * (`formatOnSavePreference`): the button and the command show those keys
 * while it does. Returns what the button needs.
 */
export function useFormatNote(
  view: () => EditorView | null,
  active: boolean,
  readOnly: boolean,
): { run: () => void; shortcut: string | undefined } {
  const t = useT();
  const shortcut = formatOnSavePreference.use() ? keys("Mod+S") : undefined;
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

  return { run, shortcut };
}
