import { useEffect, useRef, type KeyboardEvent } from "react";
import { useT } from "../i18n/i18n";
import type { NewNote } from "./use-new-note";

/**
 * The "New note" dialog, laid out as the quick switcher: a field for the
 * name and, below it, where the note will be made. Enter makes it and
 * opens it, Ctrl+Enter in a new tab. Escape or a click outside closes it.
 */
export function NewNoteDialog({ newNote }: { newNote: NewNote }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const { name, setName, path, busy, error } = newNote;

  // A modal `<dialog>` keeps the focus inside and closes on Escape.
  useEffect(() => {
    const element = dialog.current;
    if (element === null || element.open) return;
    element.showModal();
    return () => element.close();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    newNote.create(event.ctrlKey || event.metaKey);
  }

  return (
    <dialog
      ref={dialog}
      aria-label={t("tree.newNote")}
      className="mx-auto mt-[15vh] w-full max-w-[560px] overflow-hidden rounded-lg border border-line bg-bg text-ui text-fg shadow-dialog backdrop:top-bar backdrop:bg-backdrop/40 backdrop:backdrop-blur-xs"
      onCancel={(event) => {
        event.preventDefault();
        newNote.close();
      }}
      // A click on the backdrop lands on the dialog itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) newNote.close();
      }}
    >
      <input
        autoFocus
        type="text"
        aria-label={t("tree.newNoteName")}
        aria-describedby="new-note-hint"
        placeholder={t("tree.newNoteName")}
        spellCheck={false}
        autoComplete="off"
        value={name}
        readOnly={busy}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={onKeyDown}
        className="h-10 w-full border-b border-line bg-bg px-3 outline-none"
      />
      {error !== null && (
        <p role="alert" className="px-3 pt-1.5 text-small text-danger">
          {t("switcher.createFailed", { reason: error })}
        </p>
      )}
      <p
        id="new-note-hint"
        className="flex items-baseline gap-2 px-3 py-1.5 text-small text-faint"
      >
        {path === null ? (
          <span>{t("newNote.hint")}</span>
        ) : (
          <>
            <span className="min-w-0 truncate">
              {t("newNote.willCreate", { path })}
            </span>
            <span className="ml-auto shrink-0">Enter</span>
          </>
        )}
      </p>
    </dialog>
  );
}
