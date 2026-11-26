import {
  deleteMarkupBackward,
  insertNewlineContinueMarkupCommand,
} from "@codemirror/lang-markdown";
import { ChangeSet, Prec, type StateCommand } from "@codemirror/state";
import { keymap } from "@codemirror/view";

/**
 * The command of CodeMirror, without the blank line it adds on its own:
 * Enter on a blank second item does not make the list loose.
 */
const continueMarkup = insertNewlineContinueMarkupCommand({
  nonTightLists: false,
});

/** A line break, then a line of only indent and quote marks, before the next one. */
const BLANK_FIRST = /^(\r?\n[ \t>]*)(?=\r?\n)/;

/**
 * Enter in a list or a quote: a new item, or a new quoted line, right
 * under the one the cursor is on. CodeMirror puts a blank line before the
 * new item when the list is loose, which it finds by a blank line between
 * the first two items: one blank line at the top of a long list then made
 * every Enter jump a line further down. Here the new item never gets one.
 */
export const continueListItem: StateCommand = ({ state, dispatch }) =>
  continueMarkup({
    state,
    dispatch: (transaction) => {
      // The blank lines it inserted, as places in the new text.
      const blanks: { from: number; to: number }[] = [];
      transaction.changes.iterChanges((_fromA, _toA, fromB, _toB, inserted) => {
        const blank = BLANK_FIRST.exec(inserted.toString());
        if (blank !== null) {
          blanks.push({ from: fromB, to: fromB + blank[1].length });
        }
      });
      if (blanks.length === 0) {
        dispatch(transaction);
        return;
      }
      const removed = ChangeSet.of(blanks, transaction.newDoc.length);
      dispatch(
        state.update({
          changes: transaction.changes.compose(removed),
          selection: transaction.newSelection.map(removed),
          scrollIntoView: true,
          userEvent: "input",
        }),
      );
    },
  });

/**
 * The keys of Markdown in place of the keymap of `markdown()`, which is
 * turned off (`addKeymap: false`): Enter continues a list or a quote,
 * Backspace takes back its markup.
 */
export const listContinueKeymap = Prec.high(
  keymap.of([
    { key: "Enter", run: continueListItem },
    { key: "Backspace", run: deleteMarkupBackward },
  ]),
);
