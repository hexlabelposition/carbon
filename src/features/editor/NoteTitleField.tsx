import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
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
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(title.name);
  /** Escape was pressed: the blur that follows renames nothing. */
  const cancelled = useRef(false);

  // As tall as its lines: a textarea does not grow by itself everywhere.
  useLayoutEffect(() => {
    const element = field.current;
    if (element === null) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);

  async function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const renamed = await title.rename(text);
    // Taken: the note moves and this field goes with its editor. Not
    // taken: the name as it is.
    if (!renamed) setText(title.name);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      field.current?.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelled.current = true;
      setText(title.name);
      title.dismissError();
      field.current?.blur();
    }
  }

  // w-full: in the column around it, a block with auto margins would
  // shrink to its text and move to the middle. The width and padding are
  // those of the text below, so both start at one edge.
  return (
    <div className="mx-auto box-border w-full max-w-(--cb-note-width) px-8 pt-12 pb-4">
      <textarea
        ref={field}
        rows={1}
        aria-label="Note name"
        readOnly={readOnly}
        // Not a stop of the Tab key while it cannot be edited.
        tabIndex={readOnly ? -1 : undefined}
        spellCheck={false}
        value={text}
        // A name is one line: line breaks typed or pasted become spaces.
        onChange={(event) => setText(event.target.value.replace(/\r?\n/g, " "))}
        onKeyDown={onKeyDown}
        onBlur={() => void commit()}
        // Larger than a "# Heading" of the text: the name heads the note.
        className="block w-full resize-none overflow-hidden bg-transparent font-(family-name:--cb-note-font) text-[calc(var(--cb-note-size)*2.4)] leading-[1.3] font-bold tracking-[-0.025em] text-fg outline-none"
      />
      {title.error !== null && (
        <p role="alert" className="mt-1 text-small text-danger">
          Could not rename: {title.error}
        </p>
      )}
    </div>
  );
}
