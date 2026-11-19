import { useT } from "../i18n/i18n";
import { AppDialog } from "../dialogs/AppDialog";

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
  const t = useT();
  // The focus goes to the first button, "Decide later": the one answer
  // that loses nothing if Enter is pressed by accident.

  const deleted = deletedOnDisk === true;

  return (
    <AppDialog
      aria-labelledby="conflict-title"
      onClose={onLater}
      // A question to answer: a click beside it is no answer.
      closeOnOutsidePress={false}
      backdrop="bg-backdrop/70"
      className="fixed inset-0 m-auto h-fit w-full max-w-[min(520px,calc(100vw-32px))] rounded-lg border border-line bg-bg p-5 shadow-dialog"
    >
      <h2 id="conflict-title" className="text-h3 font-semibold">
        {t(deleted ? "conflict.deletedTitle" : "conflict.changedTitle", {
          name,
        })}
      </h2>
      <p className="mt-2 text-muted">
        {t(deleted ? "conflict.deletedText" : "conflict.changedText")}
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={button} onClick={onLater}>
          {t("conflict.later")}
        </button>
        <button type="button" className={button} onClick={onUseDisk}>
          {t(deleted ? "conflict.closeNote" : "conflict.useDisk")}
        </button>
        <button
          type="button"
          className="h-7 rounded-md bg-solid px-3 font-medium text-on-solid"
          onClick={onKeepMine}
        >
          {t(deleted ? "conflict.keepNote" : "conflict.keepMine")}
        </button>
      </div>
      <p className="mt-3 text-small text-faint">
        {t(deleted ? "conflict.deletedHint" : "conflict.changedHint")}
      </p>
    </AppDialog>
  );
}
