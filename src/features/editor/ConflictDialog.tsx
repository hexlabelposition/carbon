import { useEffect, useRef } from "react";

interface ConflictDialogProps {
  /** The note, as the user knows it. */
  name: string;
  /** Whether the note was deleted on disk; `null` while that is unknown. */
  deletedOnDisk: boolean | null;
  onKeepMine: () => void;
  onUseDisk: () => void;
  /** Closes the question without an answer; nothing is saved meanwhile. */
  onLater: () => void;
}

const button =
  "h-7 rounded-md border border-line-strong bg-panel px-3 hover:bg-raise";

/**
 * Asks which version of a note to keep: the one in the editor, with edits
 * that are not saved, or the one another program left on disk.
 */
export function ConflictDialog({
  name,
  deletedOnDisk,
  onKeepMine,
  onUseDisk,
  onLater,
}: ConflictDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  // A modal `<dialog>` keeps the focus inside and closes on Escape. It
  // puts the focus on its first button, "Decide later": the one answer
  // that loses nothing if Enter is pressed by accident.
  useEffect(() => {
    const element = dialog.current;
    if (element === null || element.open) return;
    element.showModal();
    return () => element.close();
  }, []);

  const deleted = deletedOnDisk === true;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="conflict-title"
      className="m-auto w-full max-w-[520px] rounded-lg border border-line bg-bg p-5 text-ui text-fg shadow-dialog backdrop:bg-backdrop/70"
      onCancel={(event) => {
        event.preventDefault();
        onLater();
      }}
    >
      <h2 id="conflict-title" className="text-h3 font-semibold">
        {deleted
          ? `“${name}” was deleted on disk`
          : `“${name}” was changed on disk`}
      </h2>
      <p className="mt-2 text-muted">
        {deleted
          ? "Another program deleted this note while you had edits that were not saved yet."
          : "Another program changed this note while you had edits that were not saved yet. Only one version can stay."}
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={button} onClick={onLater}>
          Decide later
        </button>
        <button type="button" className={button} onClick={onUseDisk}>
          {deleted ? "Close the note" : "Use the version on disk"}
        </button>
        <button
          type="button"
          className="h-7 rounded-md bg-solid px-3 font-medium text-on-solid"
          onClick={onKeepMine}
        >
          {deleted ? "Keep my note" : "Keep my version"}
        </button>
      </div>
      <p className="mt-3 text-small text-faint">
        {deleted
          ? "Keeping your note saves it again. Closing it drops your edits."
          : "The version you do not keep is lost. Until you decide, nothing is saved."}
      </p>
    </dialog>
  );
}
