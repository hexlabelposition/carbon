import { Prec } from "@codemirror/state";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { shortcutLetter } from "../workspace/shortcut-letter";

/**
 * The shortcuts of the editor on any layout. CodeMirror finds a shortcut
 * by the letter the key types, so on a Russian layout Ctrl+F types "а"
 * and finds nothing. Such a press is tried again as the Latin letter of
 * its key, as the shortcuts of the app are (`shortcutLetter`).
 */
export const layoutIndependentKeys = Prec.highest(
  EditorView.domEventHandlers({
    keydown(event, view) {
      return runAsLatin(view, event, "editor");
    },
  }),
);

/**
 * Runs the shortcuts of `scope` for `event` as if its key typed a Latin
 * letter; true if one ran. Only for a letter key with Ctrl or Cmd that
 * types another script: a Latin letter has been tried already.
 */
export function runAsLatin(
  view: EditorView,
  event: KeyboardEvent,
  scope: string,
): boolean {
  if (!event.ctrlKey && !event.metaKey) return false;
  if (/^[a-z]$/i.test(event.key)) return false;
  const letter = shortcutLetter(event);
  if (letter === null) return false;
  const latin = new KeyboardEvent("keydown", {
    key: event.shiftKey ? letter.toUpperCase() : letter,
    code: event.code,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  });
  if (!runScopeHandlers(view, latin, scope)) return false;
  event.preventDefault();
  return true;
}
