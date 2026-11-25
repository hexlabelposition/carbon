import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import {
  EditorView,
  RectangleMarker,
  layer,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

const LISTS = new Set(["BulletList", "OrderedList"]);

/** Room kept between a guide and the mark of the first nested item. */
const GAP = 3;

/**
 * Lines that show how a list nests: from below an item that holds a list
 * down to the end of that list, under the item's dot, number or checkbox.
 * Drawn in a layer below the text, so the text is not changed and an item
 * that wraps onto more lines keeps its guide along all of them. In every
 * mode: live preview, source and reading.
 */
export const listGuides: Extension = [
  layer({
    above: false,
    class: "cm-list-guides",
    update: changesGuides,
    markers: guidesOf,
  }),
  EditorView.baseTheme({
    ".cm-list-guide": { borderLeft: "1px solid var(--cb-line-strong)" },
  }),
];

/**
 * Whether the guides may have moved: the text, its layout, or the marks
 * live preview shows or hides as the cursor comes and goes.
 */
function changesGuides(update: ViewUpdate): boolean {
  return (
    update.docChanged ||
    update.viewportChanged ||
    update.geometryChanged ||
    update.selectionSet ||
    update.focusChanged ||
    syntaxTree(update.startState) !== syntaxTree(update.state)
  );
}

function guidesOf(view: EditorView): readonly RectangleMarker[] {
  const guides: RectangleMarker[] = [];
  // Where the layer starts on screen, as CodeMirror places its markers.
  const box = view.scrollDOM.getBoundingClientRect();
  const baseLeft = box.left - view.scrollDOM.scrollLeft * view.scaleX;
  const baseTop = box.top - view.scrollDOM.scrollTop * view.scaleY;
  const documentTop = view.documentTop - baseTop;
  const { doc } = view.state;
  const { from, to } = view.viewport;

  syntaxTree(view.state).iterate({
    from,
    to,
    enter(node) {
      if (node.name !== "ListItem") return;
      const item = node.node;
      const nested = nestedList(item);
      if (nested === null) return;
      const x = guideX(view, item, nested);
      if (x === null) return;
      const top = view.lineBlockAt(item.from).bottom;
      // A list can end at the start of the line after it: the line before.
      const end =
        nested.to > nested.from && doc.lineAt(nested.to).from === nested.to
          ? nested.to - 1
          : nested.to;
      const bottom = view.lineBlockAt(end).bottom;
      if (bottom <= top) return;
      guides.push(
        new RectangleMarker(
          "cm-list-guide",
          x - baseLeft,
          documentTop + top,
          null,
          bottom - top,
        ),
      );
    },
  });
  return guides;
}

/** The list nested in an item, if it has one. */
function nestedList(item: SyntaxNode): SyntaxNode | null {
  for (let child = item.firstChild; child; child = child.nextSibling) {
    if (LISTS.has(child.name)) return child;
  }
  return null;
}

/**
 * Where on screen the guide of an item stands: under the middle of what
 * shows its mark (the checkbox of a task, else the dot or the number), but
 * left of the mark of its first nested item, so it never runs through it.
 * `null` while the item is outside what the editor has drawn.
 */
function guideX(
  view: EditorView,
  item: SyntaxNode,
  nested: SyntaxNode,
): number | null {
  const mark =
    item.getChild("Task")?.getChild("TaskMarker") ?? item.getChild("ListMark");
  if (mark === null) return null;
  const start = view.coordsAtPos(mark.from, 1);
  const end = view.coordsAtPos(mark.to, -1);
  if (start === null || end === null) return null;
  let x = Math.round((start.left + end.left) / 2);
  const childMark = nested.firstChild?.getChild("ListMark");
  const child = childMark ? view.coordsAtPos(childMark.from, 1) : null;
  if (child !== null) x = Math.min(x, Math.round(child.left - GAP));
  return x;
}
