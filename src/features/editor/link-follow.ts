import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { parseNote, type Link } from "@carbon/core";
import type { OpenTarget } from "../workspace/workspace";
import type { SyntaxNode } from "@lezer/common";
import { linkHost } from "./link-completion";

/**
 * Ctrl+click, or Cmd+click, on a link to a note opens that note in a new
 * tab, and with Shift as well in the pane beside: in source mode, in a
 * link whose Markdown shows, and on Markdown links, which live preview
 * leaves as they are.
 */
export const followOnModClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return false;
    return follow(event, view, event.shiftKey ? "beside" : "newTab");
  },
});

/**
 * A click on a wiki link that live preview shows by its label opens the
 * note in place. A link whose Markdown shows, because the cursor is in it,
 * takes the click as text, so it can be edited.
 */
export const followOnClick = [
  EditorView.domEventHandlers({
    mousedown(event, view) {
      const modified =
        event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
      // Ctrl/Cmd+click is `followOnModClick`'s, though it runs later.
      if (event.button !== 0 || modified) return false;
      const target = event.target;
      // Only links that live preview shows by their label have the class.
      if (!(target instanceof Element) || !target.closest(".cm-wiki-link")) {
        return false;
      }
      return follow(event, view, "here");
    },
  }),
  EditorView.baseTheme({ ".cm-wiki-link": { cursor: "pointer" } }),
];

/** Follows the link under the mouse, if there is one to a note. */
function follow(
  event: MouseEvent,
  view: EditorView,
  target: OpenTarget,
): boolean {
  const host = view.state.facet(linkHost);
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (host === null || pos === null) return false;
  const link = linkAt(view.state, pos, host.current);
  // "[[#Heading]]" points into this note: nothing to open.
  if (link === null || link.target === "") return false;
  event.preventDefault();
  host.follow(link, { target });
  return true;
}

/**
 * The link to a note that `pos` is in, or `null`. The core decides what a
 * link points to, as the index does: web links, images and other files
 * are not links to notes.
 */
export function linkAt(
  state: EditorState,
  pos: number,
  current: string,
): Link | null {
  const node = linkNodeAt(state, pos);
  if (node === null) return null;
  const found = parseNote(current, state.doc.toString()).links.find(
    (link) => link.start === node.from,
  );
  return found ?? null;
}

/** The wiki link or Markdown link that `pos` is in, or `null`. */
function linkNodeAt(state: EditorState, pos: number): SyntaxNode | null {
  for (const side of [1, -1] as const) {
    for (
      let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side);
      node !== null;
      node = node.parent
    ) {
      if (node.name === "WikiLink" || node.name === "Link") return node;
    }
  }
  return null;
}
