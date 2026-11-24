import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";

const setHolding = StateEffect.define<boolean>();

const holdingAttributes: Record<string, string> = {
  class: "cb-holding-selection",
};
const noAttributes: Record<string, string> = {};

/**
 * Whether the editor is shown as focused while the focus is away, as in
 * its context menu (`EditorContextMenu`): live preview keeps the Markdown
 * under the cursor (`keepsFocus`), and the selection stays in sight.
 */
const holdingField = StateField.define<boolean>({
  create: () => false,
  update(holding, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setHolding)) holding = effect.value;
    }
    return holding;
  },
  provide: (field) =>
    EditorView.editorAttributes.compute([field], (state) =>
      state.field(field) ? holdingAttributes : noAttributes,
    ),
});

export const heldSelection = [
  holdingField,
  EditorView.domEventHandlers({
    // The text has the focus back: it is focused, no longer held.
    focus(_event, view) {
      holdSelection(view, false);
      return false;
    },
    // The right button leaves the selection as it is, for the menu to
    // act on: WebKitGTK would move the cursor to the press.
    mousedown(event) {
      if (event.button !== 2) return false;
      event.preventDefault();
      return true;
    },
  }),
  // The selection of the page, which the editor shows (`editorTheme`),
  // is not drawn without the focus: the one drawSelection draws takes its
  // place meanwhile, as tall as the lines, as that one. The page's is
  // hidden, so the two are not drawn over each other.
  EditorView.theme({
    "&.cb-holding-selection .cm-selectionLayer": { display: "block" },
    "&.cb-holding-selection .cm-selectionLayer .cm-selectionBackground": {
      background: "var(--cb-selection) !important",
    },
    "&.cb-holding-selection .cm-content ::selection, &.cb-holding-selection .cm-content .cm-line ::selection, &.cb-holding-selection .cm-content .cm-line::selection":
      { backgroundColor: "transparent !important" },
  }),
];

function holding(state: EditorState): boolean {
  return state.field(holdingField, false) ?? false;
}

/** Whether the editor counts as focused: it is, or it is held so. */
export function keepsFocus(view: EditorView): boolean {
  return view.hasFocus || holding(view.state);
}

/** Whether `update` started or stopped holding the editor. */
export function holdingChanged(update: ViewUpdate): boolean {
  return holding(update.startState) !== holding(update.state);
}

/** Shows `view` as focused while the focus is away, or stops. */
export function holdSelection(view: EditorView, on: boolean): void {
  if (holding(view.state) === on) return;
  view.dispatch({ effects: setHolding.of(on) });
}
