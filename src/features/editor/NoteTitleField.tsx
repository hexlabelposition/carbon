import { useRef } from "react";
import { useT } from "../i18n/i18n";
import { useNameField } from "./use-name-field";
import type { NoteTitle } from "./use-note-title";

/**
 * The name of the note as a heading above its text, in the column of the
 * text. Editing it renames the note: Enter or leaving the field renames,
 * Escape takes the edit back. A blank name is not taken: the field shows
 * the name again. A long name wraps. With `readOnly` it cannot be edited.
 */
export function NoteTitleField({
  title,
  readOnly = false,
}: {
  title: NoteTitle;
  readOnly?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const field = useNameField(title, ref);
  const { text } = field;

  // w-full: in the column around it, a block with auto margins would
  // shrink to its text and move to the middle. The width and padding are
  // those of the text below, so both start at one edge.
  return (
    <div className="mx-auto box-border w-full max-w-(--cb-note-width) px-8 pt-12 pb-4">
      {/* As tall as its lines, whatever changes them: the text, the width,
          the size of the note text or the zoom. A copy of the text, unseen,
          takes the height in the same cell of a grid, and the field fills
          it; a height measured once would cut the name off when the size
          grows later. */}
      <div className="grid">
        <div
          aria-hidden="true"
          className={`invisible [grid-area:1/1] ${TITLE_TEXT}`}
        >
          {/* A space: a name ending in one still gets its line. */}
          {text}{" "}
        </div>
        <textarea
          ref={ref}
          rows={1}
          aria-label={t("editor.noteName")}
          readOnly={readOnly}
          // Not a stop of the Tab key while it cannot be edited.
          tabIndex={readOnly ? -1 : undefined}
          spellCheck={false}
          value={text}
          // A name is one line: line breaks typed or pasted become spaces.
          onChange={(event) =>
            field.edit(event.target.value.replace(/\r?\n/g, " "))
          }
          onKeyDown={field.onKeyDown}
          onBlur={field.onBlur}
          className={`block h-full w-full resize-none overflow-hidden bg-transparent [grid-area:1/1] text-fg outline-none ${TITLE_TEXT}`}
        />
      </div>
      {title.error !== null && (
        <p role="alert" className="mt-1 text-small text-danger">
          {t("editor.renameFailed", { reason: title.error })}
        </p>
      )}
    </div>
  );
}

/**
 * The type of the name, and how it wraps, the same on the field and on
 * its unseen copy: larger than a "# Heading" of the text, as the name
 * heads the note.
 */
const TITLE_TEXT =
  "p-0 break-words whitespace-pre-wrap font-(family-name:--cb-note-font) text-[calc(var(--cb-note-size)*2.4)] leading-[1.3] font-bold tracking-[-0.025em]";
