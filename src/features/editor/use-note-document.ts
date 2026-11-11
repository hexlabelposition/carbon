import {
  Autosave,
  contentHash,
  type NotePath,
  type SaveState,
  type Vault,
} from "@carbon/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveNote } from "../workspace/active-note";

export type NoteDocument =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      /** The text the editor starts with. */
      text: string;
      /** Where the edits stand compared to the note on disk. */
      save: SaveState;
    };

export interface NoteDocumentActions {
  /** Tell it the whole text after every edit; it is saved after a pause. */
  edited(text: string): void;
  /** Saves now, without waiting for a pause. Also retries a failed save. */
  saveNow(): void;
}

/**
 * One open note: reads it, then saves the edits on their own. The edits are
 * also saved when the window loses focus and when the note is closed.
 */
export function useNoteDocument(
  vault: Vault,
  path: NotePath,
): [NoteDocument, NoteDocumentActions] {
  const { onFlush } = useActiveNote();
  const [loaded, setLoaded] = useState<{
    path: NotePath;
    value: NoteDocument;
  } | null>(null);
  const autosave = useRef<Autosave | null>(null);

  useEffect(() => {
    // A slow read of the previous note must not replace this one.
    let stale = false;
    let saver: Autosave | null = null;
    const flush = () => saver?.flush() ?? Promise.resolve();

    vault.notes.read(path).then(
      (text) => {
        if (stale) return;
        const show = (save: SaveState) =>
          setLoaded({ path, value: { status: "ready", text, save } });
        saver = new Autosave({
          notes: vault.notes,
          path,
          baseHash: contentHash(text),
          onState: show,
        });
        autosave.current = saver;
        show(saver.state);
      },
      (reason: unknown) => {
        const message =
          reason instanceof Error ? reason.message : String(reason);
        if (!stale) setLoaded({ path, value: { status: "error", message } });
      },
    );

    const stopFlushing = onFlush(flush);
    const onBlur = () => void flush();
    window.addEventListener("blur", onBlur);
    // The window is closing: start the write, it may still get through.
    window.addEventListener("pagehide", onBlur);
    return () => {
      stale = true;
      stopFlushing();
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onBlur);
      if (autosave.current === saver) autosave.current = null;
      void saver?.close();
    };
  }, [vault, path, onFlush]);

  const edited = useCallback((text: string) => {
    autosave.current?.edit(text);
  }, []);
  const saveNow = useCallback(() => {
    void autosave.current?.flush();
  }, []);

  return [
    loaded?.path === path ? loaded.value : { status: "loading" },
    { edited, saveNow },
  ];
}
