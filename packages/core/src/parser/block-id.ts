import { tags } from "@lezer/highlight";
import type { InlineContext, MarkdownConfig } from "@lezer/markdown";

/**
 * Block ids in Lezer Markdown: `^id` at the end of a paragraph, a list
 * item or a quote names that block, so `[[Note#^id]]` can point to it, as
 * in Obsidian. The editor and the indexer both use it, as with wiki links
 * (ADR-012). Which block an id names is for `blockIds`.
 *
 * - The id is letters, digits and `-`, with no spaces: `^my-block-1`.
 * - It comes after white space or at the start of a line, and nothing but
 *   white space follows it to the end of the block: `a ^b c` has none.
 * - Alone on the line under a table, a quote or a code block, it names
 *   that block.
 * - Read before superscript, so `^id` is never the start of one.
 */
export const blockId: MarkdownConfig = {
  defineNodes: [{ name: "BlockId", style: tags.meta }],
  parseInline: [
    { name: "BlockId", parse: parseBlockId, before: "Superscript" },
  ],
};

const CARET = 94; // ^
const ID = /^[A-Za-z0-9-]+/;

/** Whether `id` can be written after "^" as a block id. */
export function isBlockId(id: string): boolean {
  return ID.exec(id)?.[0] === id;
}

function parseBlockId(cx: InlineContext, next: number, pos: number): number {
  if (next !== CARET) return -1;
  if (pos > cx.offset && !/\s/.test(cx.slice(pos - 1, pos))) return -1;
  const rest = cx.slice(pos + 1, cx.end);
  const id = ID.exec(rest)?.[0];
  if (id === undefined || rest.slice(id.length).trim() !== "") return -1;
  return cx.addElement(cx.elt("BlockId", pos, pos + 1 + id.length));
}
