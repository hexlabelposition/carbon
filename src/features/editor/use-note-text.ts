import type { NotePath, Vault } from "@carbon/core";
import { useEffect, useState } from "react";

export type NoteText =
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "error"; message: string };

/** Reads the text of a note, again whenever another note is asked for. */
export function useNoteText(vault: Vault, path: NotePath): NoteText {
  const [loaded, setLoaded] = useState<{
    path: NotePath;
    result: NoteText;
  } | null>(null);

  useEffect(() => {
    // A slow read of the previous note must not replace this one.
    let stale = false;
    vault.notes.read(path).then(
      (text) => {
        if (!stale) setLoaded({ path, result: { status: "ready", text } });
      },
      (reason: unknown) => {
        const message =
          reason instanceof Error ? reason.message : String(reason);
        if (!stale) setLoaded({ path, result: { status: "error", message } });
      },
    );
    return () => {
      stale = true;
    };
  }, [vault, path]);

  return loaded?.path === path ? loaded.result : { status: "loading" };
}
