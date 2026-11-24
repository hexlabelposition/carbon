import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

/**
 * The marks that wrap the selection when typed over it: emphasis, strong
 * (typed twice), code, strikethrough (twice) and highlight (twice).
 */
const WRAPPERS = new Set(["*", "_", "`", "~", "="]);

/**
 * Typing in the text of a note, as in an editor of Markdown:
 *
 * - An opening bracket or quote, `(`, `[`, `{` or `"`, comes with its
 *   closing one, the cursor between; typing the closing one steps over
 *   it, and Backspace between the two takes both. "[[" so becomes "[[]]",
 *   which the link suggestions fill (`linkCompletion`). With text
 *   selected, the pair goes around it.
 * - A mark typed over selected text goes around it, and the text stays
 *   selected: `*` twice makes it strong, `` ` `` makes it code. Marks are
 *   not paired while nothing is selected: "```" opens a code block and
 *   "* " a list, which a pair would break.
 *
 * Inside a code block the language of the block decides what is paired.
 */
export const markdownInput = [
  markdownLanguage.data.of({
    closeBrackets: { brackets: ["(", "[", "{", '"'] },
  }),
  closeBrackets(),
  keymap.of(closeBracketsKeymap),
  // Before the editor inserts the mark in place of the selection.
  Prec.high(
    EditorView.inputHandler.of((view, _from, _to, text) => {
      if (!WRAPPERS.has(text) || view.state.readOnly) return false;
      const { selection } = view.state;
      if (selection.ranges.every((range) => range.empty)) return false;
      view.dispatch(
        view.state.changeByRange((range) => {
          if (range.empty) {
            return {
              changes: { from: range.from, insert: text },
              range: EditorSelection.cursor(range.from + text.length),
            };
          }
          return {
            changes: [
              { from: range.from, insert: text },
              { from: range.to, insert: text },
            ],
            range: EditorSelection.range(
              range.from + text.length,
              range.to + text.length,
            ),
          };
        }),
        { userEvent: "input.type", scrollIntoView: true },
      );
      return true;
    }),
  ),
];
