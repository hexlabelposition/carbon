import { tags } from "@lezer/highlight";
import type { Element, InlineContext, MarkdownConfig } from "@lezer/markdown";

/**
 * Wiki links in Lezer Markdown (ARCHITECTURE.md, section 4.2):
 *
 * - `[[Note]]`
 * - `[[Note|alias]]`
 * - `[[Note#Heading]]`, also `[[Note#Heading#Subheading]]`
 * - `[[#Heading]]`: a heading of the same note
 *
 * The editor and the indexer both use it, so what the editor shows as a
 * link is exactly what the index stores (ADR-012).
 *
 * The tree of `[[folder/Note#Heading|alias]]`:
 *
 * ```
 * WikiLink
 *   WikiLinkMark      "[["
 *   WikiLinkTarget    "folder/Note"
 *   WikiLinkMark      "#"
 *   WikiLinkFragment  "Heading"
 *   WikiLinkMark      "|"
 *   WikiLinkAlias     "alias"
 *   WikiLinkMark      "]]"
 * ```
 *
 * Parts that are empty have no node. The text of the parts is kept as
 * written, spaces included; trimming is for whoever reads the link.
 *
 * A wiki link stays on one line. In a table cell the alias is written
 * after `\|`, as a bare `|` ends the cell; `\|` works outside tables too.
 */
export const wikiLink: MarkdownConfig = {
  defineNodes: [
    { name: "WikiLink", style: tags.link },
    { name: "WikiLinkMark", style: tags.processingInstruction },
    { name: "WikiLinkTarget", style: tags.link },
    { name: "WikiLinkFragment", style: tags.link },
    { name: "WikiLinkAlias", style: tags.link },
  ],
  parseInline: [
    {
      name: "WikiLink",
      // Before Markdown links, which would take "[" for their own.
      before: "Link",
      parse: parseWikiLink,
    },
  ],
};

const BANG = 33; // !
const OPEN = 91; // [
const CLOSE = 93; // ]
const HASH = 35; // #
const PIPE = 124; // |
const BACKSLASH = 92; // \
const NEWLINE = 10;

function parseWikiLink(cx: InlineContext, next: number, pos: number): number {
  // "![[Note]]" embeds a note. Markdown would take "![" as the start of an
  // image, so the link is found from here; the "!" stays text.
  const start = next === BANG ? pos + 1 : pos;
  if (cx.char(start) !== OPEN || cx.char(start + 1) !== OPEN) return -1;

  const elements: Element[] = [cx.elt("WikiLinkMark", start, start + 2)];
  let part: PartName = "WikiLinkTarget";
  /** Where the part that is being read began. */
  let from = start + 2;
  /** The parts that hold more than spaces: a link needs a target or a heading. */
  const filled = new Set<PartName>();

  const endPart = (at: number, markLength: number) => {
    if (at > from) elements.push(cx.elt(part, from, at));
    if (cx.slice(from, at).trim() !== "") filled.add(part);
    elements.push(cx.elt("WikiLinkMark", at, at + markLength));
  };

  for (let at = from; at < cx.end; at++) {
    const char = cx.char(at);
    if (char === NEWLINE) return -1;

    if (char === CLOSE && cx.char(at + 1) === CLOSE) {
      endPart(at, 2);
      if (!filled.has("WikiLinkTarget") && !filled.has("WikiLinkFragment")) {
        return -1;
      }
      return cx.addElement(cx.elt("WikiLink", start, at + 2, elements));
    }

    // The alias is free text: only "]]" and the end of the line end it.
    if (part === "WikiLinkAlias") continue;

    // No brackets in a target or a heading: "[[a [b]] c]]" is no link, and
    // "[[[Note]]]" is a link in brackets, found from the next "[".
    if (char === OPEN || char === CLOSE) return -1;

    const pipe =
      char === PIPE
        ? 1
        : char === BACKSLASH && cx.char(at + 1) === PIPE
          ? 2
          : 0;
    if (pipe > 0) {
      endPart(at, pipe);
      part = "WikiLinkAlias";
      from = at + pipe;
      at = from - 1;
    } else if (char === HASH && part === "WikiLinkTarget") {
      // The first "#" starts the heading; later ones belong to it, for
      // nested headings.
      endPart(at, 1);
      part = "WikiLinkFragment";
      from = at + 1;
    }
  }
  return -1;
}

type PartName = "WikiLinkTarget" | "WikiLinkFragment" | "WikiLinkAlias";
