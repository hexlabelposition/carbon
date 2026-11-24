import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

/** The ranges to keep showing, or `null` to stop. */
const hold = StateEffect.define<
  readonly { from: number; to: number }[] | null
>();

const held = Decoration.mark({ class: "cb-held-selection" });
const holding: Record<string, string> = { class: "cb-holding-selection" };
const notHolding: Record<string, string> = {};

/**
 * The selection, shown while the focus is away from the text, as in the
 * context menu (`EditorContextMenu`): the selection of the page, which
 * the editor shows (`editorTheme`), is not drawn without the focus.
 * Marks over the text, as that one; it is hidden meanwhile, so the two
 * are not drawn over each other.
 */
const heldSelectionField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    let next = marks.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(hold)) continue;
      next =
        effect.value === null
          ? Decoration.none
          : Decoration.set(
              effect.value.map((r) => held.range(r.from, r.to)),
              true,
            );
    }
    return next;
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.editorAttributes.compute([field], (state) =>
      state.field(field).size > 0 ? holding : notHolding,
    ),
  ],
});

export const heldSelection = [
  heldSelectionField,
  EditorView.domEventHandlers({
    // The right button leaves the selection as it is, for the menu to
    // act on: WebKitGTK would move the cursor to the press.
    mousedown(event) {
      if (event.button !== 2) return false;
      event.preventDefault();
      return true;
    },
  }),
  EditorView.theme({
    ".cb-held-selection": { backgroundColor: "var(--cb-selection)" },
    "&.cb-holding-selection .cm-content ::selection, &.cb-holding-selection .cm-content .cm-line ::selection, &.cb-holding-selection .cm-content .cm-line::selection":
      { backgroundColor: "transparent !important" },
  }),
];

/** Keeps showing the selected text of `view`, or stops. */
export function holdSelection(view: EditorView, on: boolean): void {
  const ranges = on
    ? view.state.selection.ranges.filter((r) => !r.empty)
    : null;
  const holding = view.state.field(heldSelectionField).size > 0;
  if (ranges === null && !holding) return;
  view.dispatch({
    effects: hold.of(ranges === null || ranges.length === 0 ? null : ranges),
  });
}
