import { formatNote } from "@carbon/core";
import type { EditorView } from "@codemirror/view";

/**
 * Tidies up the layout of the note in `view` (`formatNote`): no blank
 * lines at its start, one around each heading, one line break at its
 * end. One step to undo; the cursor stays where it was in the text.
 * False when the note is tidy already or cannot be edited.
 */
export function formatNoteText(view: EditorView): boolean {
  if (view.state.readOnly) return false;
  const changes = formatNote(view.state.doc.toString());
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: "input.format" });
  return true;
}
