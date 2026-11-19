import type { NotePath, Vault } from "@carbon/core";
import { useCallback, useState } from "react";
import { t } from "../i18n/i18n";
import { useWorkspace } from "../workspace/workspace";
import { handOver } from "./use-note-document";
import { errorText } from "../i18n/error-text";

export interface NoteTitle {
  /** The file name of the note, without `.md`. */
  name: string;
  /**
   * Renames the note to `text`, in its folder. Blank text, or the same
   * name, changes nothing. Resolves to whether the note now has `text` as
   * its name; if not, `error` tells why.
   */
  rename(text: string): Promise<boolean>;
  /** Why the last rename failed, until the next one. */
  error: string | null;
  dismissError(): void;
}

/**
 * The name of a note as its title: shown above the text and renamed by
 * editing it, as in the file tree. Links in other notes follow the rename.
 */
export function useNoteTitle(vault: Vault, path: NotePath): NoteTitle {
  const { flush, moved } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash + 1);
  const name = path.slice(slash + 1).replace(/\.md$/i, "");

  const rename = useCallback(
    async (text: string) => {
      setError(null);
      const next = text.trim();
      if (next === "" || next === name) return false;
      if (/[\\/]/.test(next)) {
        setError(t("tree.badName"));
        return false;
      }
      const to = `${folder}${next}.md`;
      let onDisk: string;
      try {
        // Edits not written yet must reach the file before it moves.
        await flush();
        onDisk = await vault.notes.read(path);
        await vault.notes.rename(path, to);
      } catch (reason) {
        setError(errorText(reason));
        return false;
      }
      // The editor of the new path starts from this text: no blink.
      handOver(to, onDisk);
      moved(path, to);
      return true;
    },
    [vault, path, folder, name, flush, moved],
  );

  return { name, rename, error, dismissError: () => setError(null) };
}
