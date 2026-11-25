import { useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { isMac } from "../commands/commands";
import { shortcutLetter } from "../workspace/shortcut-letter";
import type { NoteTitle } from "./use-note-title";

export interface NameField<
  Element extends HTMLInputElement | HTMLTextAreaElement,
> {
  /** The name as it is being edited. */
  text: string;
  /** Takes an edit of the field, as a step that can be undone. */
  edit(text: string): void;
  onKeyDown(event: KeyboardEvent<Element>): void;
  onBlur(): void;
}

/**
 * A field that renames a note by editing its name: Enter or leaving the
 * field renames, Escape takes the edit back. A blank name, or one that is
 * not taken, shows the name again. The same for the title above the text
 * and the name in the bar above the note. `ref` is the field, to take
 * its focus away.
 *
 * Ctrl+Z undoes an edit and Ctrl+Shift+Z or Ctrl+Y redoes it, kept here:
 * the field's own undo did nothing in the app on Linux (WebKitGTK).
 */
export function useNameField<
  Element extends HTMLInputElement | HTMLTextAreaElement,
>(title: NoteTitle, ref: RefObject<Element | null>): NameField<Element> {
  const [text, setText] = useState(title.name);
  /** Escape was pressed: the blur that follows renames nothing. */
  const cancelled = useRef(false);
  /** The texts the field has had, and which of them it shows. */
  const history = useRef({ steps: [title.name], at: 0 });

  /** Starts the steps anew from `start`, as after Escape. */
  function reset(start: string) {
    history.current = { steps: [start], at: 0 };
    setText(start);
  }

  function edit(next: string) {
    const { steps, at } = history.current;
    history.current = { steps: [...steps.slice(0, at + 1), next], at: at + 1 };
    setText(next);
  }

  /** Goes `by` steps back (negative) or forward, if there are any. */
  function step(by: number) {
    const { steps, at } = history.current;
    const to = at + by;
    if (to < 0 || to >= steps.length) return;
    history.current = { steps, at: to };
    setText(steps[to]);
  }

  async function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const renamed = await title.rename(text);
    // Taken: the note moves and the field goes with its editor. Not
    // taken: the name as it is.
    if (!renamed) reset(title.name);
  }

  function onKeyDown(event: KeyboardEvent<Element>) {
    const mod = isMac ? event.metaKey : event.ctrlKey;
    const letter = mod && !event.altKey ? shortcutLetter(event) : null;
    if (letter === "z") {
      event.preventDefault();
      step(event.shiftKey ? 1 : -1);
    } else if (letter === "y" && !event.shiftKey) {
      event.preventDefault();
      step(1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      ref.current?.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelled.current = true;
      reset(title.name);
      title.dismissError();
      ref.current?.blur();
    }
  }

  return { text, edit, onKeyDown, onBlur: () => void commit() };
}
