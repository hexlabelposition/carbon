import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/**
 * What a wiki link shows in place of its Markdown: the alias if it has one,
 * else the note and the heading, as "Note > Heading".
 */
export function wikiLinkLabel(state: EditorState, link: SyntaxNode): string {
  const part = (name: string) => {
    const node = link.getChild(name);
    return node === null ? "" : state.sliceDoc(node.from, node.to).trim();
  };
  const alias = part("WikiLinkAlias");
  if (alias !== "") return alias;
  return [part("WikiLinkTarget"), part("WikiLinkFragment")]
    .filter((text) => text !== "")
    .join(" > ");
}
