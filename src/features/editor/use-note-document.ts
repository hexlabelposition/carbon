import {
  Autosave,
  contentHash,
  type NotePath,
  type SaveState,
  type Vault,
} from "@carbon/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { isWithin } from "../vault/paths";
import { useActiveNote } from "../workspace/active-note";

export type NoteDocument =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      /** The text as it was last read from disk. */
      text: string;
      /**
       * Grows every time `text` is read again: the editor then shows `text`
       * in place of what it holds, even if the two reads gave equal text.
       */
      revision: number;
      /** Where the edits stand compared to the note on disk. */
      save: SaveState;
      /**
       * While `save` is a conflict: whether the note on disk was deleted
       * rather than changed. `null` until that is known.
       */
      deletedOnDisk: boolean | null;
    };

export interface NoteDocumentActions {
  /** Tell it the whole text after every edit; it is saved after a pause. */
  edited(text: string): void;
  /** Saves now, without waiting for a pause. Also retries a failed save. */
  saveNow(): void;
  /** Resolves a conflict: the text in the editor replaces the disk version. */
  keepMine(): void;
  /**
   * Resolves a conflict: the editor shows the disk version and the unsaved
   * edits are dropped. If the note was deleted on disk, it is closed.
   */
  useDisk(): void;
}

type Ready = Extract<NoteDocument, { status: "ready" }>;

/** What the mounted note needs to act on its autosave from outside the effect. */
interface Session {
  saver: Autosave;
  /** Reads the note again; `null` if it cannot be read (it is gone). */
  readDisk(): Promise<string | null>;
  /** Shows `text`, just read from disk, in place of the editor's text. */
  showDisk(text: string): void;
}

/**
 * One open note: reads it, saves the edits on their own, and keeps up with
 * changes other programs make to it (ARCHITECTURE.md, section 9):
 *
 * - no unsaved edits: the note is read again and shown;
 * - unsaved edits: nothing is overwritten on either side, and `save`
 *   becomes a conflict for the user to resolve.
 *
 * The edits are also saved when the window loses focus and when the note
 * is closed.
 */
export function useNoteDocument(
  vault: Vault,
  path: NotePath,
): [NoteDocument, NoteDocumentActions] {
  const { onFlush, close } = useActiveNote();
  const [loaded, setLoaded] = useState<{
    path: NotePath;
    value: NoteDocument;
  } | null>(null);
  const session = useRef<Session | null>(null);

  useEffect(() => {
    // Nothing of this note may reach the state once another one is shown.
    let stale = false;
    let current: Session | null = null;

    const update = (change: (ready: Ready) => Ready) =>
      setLoaded((now) =>
        now?.path === path && now.value.status === "ready"
          ? { path, value: change(now.value) }
          : now,
      );

    const readDisk = () =>
      vault.notes.read(path).then(
        (text) => text,
        () => null,
      );

    function start(text: string) {
      const saver = new Autosave({
        notes: vault.notes,
        path,
        baseHash: contentHash(text),
        onState(save) {
          update((ready) => ({ ...ready, save, deletedOnDisk: null }));
          if (save.status !== "conflict") return;
          // For the wording of the question: changed, or deleted?
          void readDisk().then((disk) => {
            if (stale || saver.state.status !== "conflict") return;
            update((ready) => ({ ...ready, deletedOnDisk: disk === null }));
          });
        },
      });
      current = {
        saver,
        readDisk,
        showDisk(disk) {
          saver.useDisk(contentHash(disk));
          update((ready) => ({
            ...ready,
            text: disk,
            revision: ready.revision + 1,
          }));
        },
      };
      session.current = current;
      setLoaded({
        path,
        value: {
          status: "ready",
          text,
          revision: 0,
          save: saver.state,
          deletedOnDisk: null,
        },
      });
    }

    vault.notes.read(path).then(
      (text) => {
        if (!stale) start(text);
      },
      (reason: unknown) => {
        const message =
          reason instanceof Error ? reason.message : String(reason);
        if (!stale) setLoaded({ path, value: { status: "error", message } });
      },
    );

    /** Another program changed or deleted this note. */
    async function onOutsideChange(removed: boolean) {
      if (current === null) {
        // Still being read for the first time: there is nothing to rescue.
        if (removed) close();
        return;
      }
      const { saver, showDisk } = current;
      if (saver.state.status !== "saved") {
        // There are unsaved edits. Writing them now finds out what this is:
        // a conflict, or the very same text arriving from elsewhere.
        void saver.flush();
        return;
      }
      if (removed) {
        close();
        return;
      }
      const disk = await readDisk();
      if (stale || disk === null) return;
      // Typed while the note was being read: now it is the case above.
      if (saver.state.status !== "saved") void saver.flush();
      else showDisk(disk);
    }

    const stopWatching = vault.on("changed", (change) => {
      if (change.kind === "removed") {
        // Deleting a folder deletes the notes inside it.
        if (isWithin(path, change.path)) void onOutsideChange(true);
      } else if (change.path === path) void onOutsideChange(false);
    });

    const flush = () => current?.saver.flush() ?? Promise.resolve();
    const stopFlushing = onFlush(flush);
    const onBlur = () => void flush();
    window.addEventListener("blur", onBlur);
    // The window is closing: start the write, it may still get through.
    window.addEventListener("pagehide", onBlur);
    return () => {
      stale = true;
      stopWatching();
      stopFlushing();
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onBlur);
      if (session.current === current) session.current = null;
      void current?.saver.close();
    };
  }, [vault, path, onFlush, close]);

  const edited = useCallback((text: string) => {
    session.current?.saver.edit(text);
  }, []);

  const saveNow = useCallback(() => {
    void session.current?.saver.flush();
  }, []);

  const keepMine = useCallback(() => {
    const now = session.current;
    if (now === null) return;
    void now
      .readDisk()
      .then((disk) =>
        now.saver.keepMine(disk === null ? null : contentHash(disk)),
      );
  }, []);

  const useDisk = useCallback(() => {
    const now = session.current;
    if (now === null) return;
    void now.readDisk().then((disk) => {
      if (session.current !== now) return;
      // Deleted on disk: the disk version of the note is "no note".
      if (disk === null) close();
      else now.showDisk(disk);
    });
  }, [close]);

  return [
    loaded?.path === path ? loaded.value : { status: "loading" },
    { edited, saveNow, keepMine, useDisk },
  ];
}
