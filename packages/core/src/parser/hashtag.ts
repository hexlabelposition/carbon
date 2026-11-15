import { tags } from "@lezer/highlight";
import type { InlineContext, MarkdownConfig } from "@lezer/markdown";

/**
 * Inline tags in Lezer Markdown (ARCHITECTURE.md, section 4.2): `#tag`
 * and nested `#area/topic`. The editor and the indexer both use it, as
 * with wiki links (ADR-012).
 *
 * The tree of `#area/topic`:
 *
 * ```
 * Hashtag
 *   HashtagMark   "#"
 *   HashtagLabel  "area/topic"
 * ```
 *
 * - A tag starts at the start of a line or after white space: `word#x`,
 *   `(#x)` and the `#x` of a web address are no tags.
 * - Its label is letters of any script, digits, `_` and `-`, in parts
 *   joined by single slashes. It ends at anything else: `#a/b/` is the
 *   tag `a/b`, and `#a//b` the tag `a`.
 * - It has a letter: `#2026` and `#1` are numbers, not tags.
 * - `# Heading` is a heading, not a tag; inside code, links and web
 *   addresses nothing is a tag, as those are read first.
 */
export const hashtag: MarkdownConfig = {
  defineNodes: [
    {
      name: "Hashtag",
      // "/...": the parts take the style too. A style of the tag alone
      // would cover no text, as its parts cover all of it; with one style
      // for both, the editor draws the tag as one piece.
      style: { "Hashtag/...": tags.special(tags.labelName) },
    },
    { name: "HashtagMark" },
    { name: "HashtagLabel" },
  ],
  parseInline: [{ name: "Hashtag", parse: parseHashtag }],
};

const HASH = 35; // #
/** The longest label looked for: a tag is a word or a few, not a line. */
const MAX_LABEL = 200;
const LABEL = /^[\p{L}\p{N}\p{M}_-]+(?:\/[\p{L}\p{N}\p{M}_-]+)*/u;

function parseHashtag(cx: InlineContext, next: number, pos: number): number {
  if (next !== HASH) return -1;
  if (pos > cx.offset && !/\s/.test(cx.slice(pos - 1, pos))) return -1;
  const rest = cx.slice(pos + 1, Math.min(cx.end, pos + 1 + MAX_LABEL));
  const label = LABEL.exec(rest)?.[0];
  if (label === undefined || !/\p{L}/u.test(label)) return -1;
  const end = pos + 1 + label.length;
  return cx.addElement(
    cx.elt("Hashtag", pos, end, [
      cx.elt("HashtagMark", pos, pos + 1),
      cx.elt("HashtagLabel", pos + 1, end),
    ]),
  );
}
