import type { NotePath, Vault } from "@carbon/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { useWorkspace } from "../workspace/workspace";
import { useDialog } from "../dialogs/open-dialog";
import { matchesShortcut, useShortcutLabel } from "../shortcuts/shortcuts";
import { newNotePath } from "./new-note-path";
import { errorText } from "../i18n/error-text";

export interface NewNote {
  isOpen: boolean;
  close(): void;
  name: string;
  setName(name: string): void;
  /** Where the note would be made, or `null` while nothing is typed. */
  path: NotePath | null;
  /** Makes the note and opens it, in a new tab with `newTab`. */
  create(newTab: boolean): void;
  /** A note is being made: the dialog waits. */
  busy: boolean;
  /** Why the last `create` failed, until the name changes. */
  error: string | null;
}

/**
 * "New note": Ctrl+N (Cmd+N on a Mac), the palette or the start of the
 * note area open a dialog that asks for the name, without the file tree.
 * The note is made at the vault root, or in the folders typed before the
 * name, and opened.
 */
export function useNewNote(vault: Vault): NewNote {
  const t = useT();
  const { open } = useWorkspace();
  const [isOpen, setOpen] = useDialog("newNote");
  const shortcut = useShortcutLabel("note.new");
  const [name, setNameState] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setName = useCallback((next: string) => {
    setNameState(next);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setName("");
  }, [setOpen, setName]);

  // Empty each time: another dialog may have closed it, not `close`.
  const show = useCallback(() => {
    setName("");
    setOpen(true);
  }, [setOpen, setName]);

  useCommands(
    useMemo(
      () => [
        {
          id: NEW_NOTE,
          title: t("tree.newNote"),
          shortcut,
          run: show,
        },
      ],
      [t, show, shortcut],
    ),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, "note.new")) return;
      show();
      // Not the browser's "new window", nor the editor's use of the key.
      event.preventDefault();
      event.stopPropagation();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [show]);

  const path = newNotePath(name);

  const create = useCallback(
    (newTab: boolean) => {
      if (path === null || busy) return;
      setBusy(true);
      vault.notes
        .create(path)
        .then(
          () => {
            open(path, { target: newTab ? "newTab" : "here" });
            close();
          },
          (reason: unknown) => setError(errorText(reason)),
        )
        .finally(() => setBusy(false));
    },
    [vault, path, busy, open, close],
  );

  return { isOpen, close, name, setName, path, create, busy, error };
}

/** The id of the "New note" command. */
export const NEW_NOTE = "note.new";
