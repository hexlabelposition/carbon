import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { parseNote } from "@carbon/core";
import type { SyntaxNode } from "@lezer/common";
import { linkHost } from "./link-completion";

/**
 * Ctrl+click, or Cmd+click, on a link to a note opens that note in a new
 * tab: in source mode, in a link whose Markdown shows, and on Markdown
 * links, which live preview leaves as they are.
 */
export const followOnModClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return false;
    return follow(event, view, true);
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
      if (event.button !== 0 || event.shiftKey || event.altKey) return false;
      const target = event.target;
      // Only links that live preview shows by their label have the class.
      if (!(target instanceof Element) || !target.closest(".cm-wiki-link")) {
        return false;
      }
      return follow(event, view, false);
    },
  }),
  EditorView.baseTheme({ ".cm-wiki-link": { cursor: "pointer" } }),
];

/** Follows the link under the mouse, if there is one to a note. */
function follow(event: MouseEvent, view: EditorView, newTab: boolean): boolean {
  const host = view.state.facet(linkHost);
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (host === null || pos === null) return false;
  const node = linkNodeAt(view.state, pos);
  if (node === null) return false;
  // The core decides what the link points to, as the index does: web
  // links, images and other files are not links to notes.
  const link = parseNote(host.current, view.state.doc.toString()).links.find(
    (found) => found.start === node.from,
  );
  // "[[#Heading]]" points into this note: nothing to open.
  if (link === undefined || link.target === "") return false;
  event.preventDefault();
  host.follow(link, { newTab });
  return true;
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
