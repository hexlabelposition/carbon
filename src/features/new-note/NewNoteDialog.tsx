import type { KeyboardEvent } from "react";
import { useT } from "../i18n/i18n";
import type { NewNote } from "./use-new-note";
import { AppDialog } from "../dialogs/AppDialog";

/**
 * The "New note" dialog, laid out as the quick switcher: a field for the
 * name and, below it, where the note will be made. Enter makes it and
 * opens it, Ctrl+Enter in a new tab. Escape or a click outside closes it.
 */
export function NewNoteDialog({ newNote }: { newNote: NewNote }) {
  const t = useT();
  const { name, setName, path, busy, error } = newNote;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    newNote.create(event.ctrlKey || event.metaKey);
  }

  return (
    <AppDialog
      aria-label={t("tree.newNote")}
      onClose={newNote.close}
      className="fixed inset-x-0 top-[15vh] mx-auto w-full max-w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
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
    </AppDialog>
  );
}
