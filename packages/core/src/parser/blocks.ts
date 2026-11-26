import type { SyntaxNode, Tree } from "@lezer/common";
import { findFrontmatter } from "./frontmatter";
import { markdownParser, parseNote } from "./parse-note";

/** Where a part of a note starts and ends: offsets into its text. */
export interface FragmentRange {
  from: number;
  to: number;
}

/**
 * A block of a note that a link can point to with `[[Note#^id]]`: a
 * paragraph, a list item with the items nested in it, a whole quote (a
 * callout too), a table or a code block.
 */
export interface NoteBlock {
  /** Its id, without "^"; `null` if it has none yet. */
  id: string | null;
  /** Where it starts and ends in the text, without its id on a line below. */
  from: number;
  to: number;
  /** Its text on one line, without Markdown marks, for a list to pick from. */
  label: string;
  /** What `markBlock` inserts the id with: at this offset, after this. */
  idAt: number;
  idOwnLine: boolean;
}

/** Nodes that are a block of their own, and their kind. */
const KINDS = new Set([
  "Paragraph",
  "ListItem",
  "Blockquote",
  "Table",
  "FencedCode",
  "CodeBlock",
]);

/**
 * Every block of a note a link can point to, in the order of the text,
 * with the ids they have. A list item counts once, with its nested items,
 * and each nested item counts as well; a quote counts as a whole, not its
 * paragraphs. The frontmatter is not looked at.
 */
export function noteBlocks(text: string): NoteBlock[] {
  const body = blankFrontmatter(text);
  const tree = markdownParser.parse(body);
  const ids = idsOf(body, tree);
  const blocks: NoteBlock[] = [];
  const visit = (node: SyntaxNode) => {
    for (
      let child = node.firstChild;
      child !== null;
      child = child.nextSibling
    ) {
      if (!KINDS.has(child.name)) {
        if (child.name.endsWith("List")) visit(child);
        continue;
      }
      if (child.name === "Paragraph") {
        // A paragraph that is only an id names the block before it; the
        // first paragraph of a list item is the item.
        if (standaloneId(body, child) !== null) continue;
        if (
          node.name === "ListItem" &&
          child.from === firstParagraph(node)?.from
        ) {
          continue;
        }
      }
      const found = ids.get(child.from);
      const end = found?.to ?? child.to;
      const own = child.name !== "Paragraph" && child.name !== "ListItem";
      const textEnd =
        child.name === "ListItem"
          ? (firstParagraph(child)?.to ?? child.to)
          : end;
      blocks.push({
        id: found?.id ?? null,
        from: child.from,
        to: end,
        label: labelOf(body.slice(child.from, textEnd)),
        idAt: own ? end : textEnd,
        idOwnLine: own,
      });
      if (child.name === "ListItem") visit(child);
    }
  };
  visit(tree.topNode);
  return blocks;
}

/**
 * Where the part of a note a link fragment points to starts and ends:
 * `^id`, the block with that id; a heading, its section, up to the next
 * heading of the same level or a higher one. `null` if the note has no
 * such block or heading. Headings are matched as `asFragment` writes them,
 * in any case.
 */
export function fragmentRange(
  text: string,
  fragment: string,
): FragmentRange | null {
  const body = blankFrontmatter(text);
  const tree = markdownParser.parse(body);
  if (fragment.startsWith("^")) {
    const id = fragment.slice(1).toLowerCase();
    for (const found of idsOf(body, tree).values()) {
      if (found.id.toLowerCase() === id)
        return { from: found.from, to: found.to };
    }
    return null;
  }
  // The headings as the index reads them: their text without marks.
  const headings = parseNote("", text).headings;
  const wanted = asFragment(fragment).toLowerCase();
  const index = headings.findIndex(
    (h) => asFragment(h.text).toLowerCase() === wanted,
  );
  if (index === -1) return null;
  const heading = headings[index]!;
  const next = headings.slice(index + 1).find((h) => h.level <= heading.level);
  return { from: heading.pos, to: next?.pos ?? body.length };
}

/**
 * A heading as it can be written after "#" in a wiki link: the characters
 * that end the link or its parts are left out.
 */
export function asFragment(heading: string): string {
  return heading
    .replace(/[[\]|#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** An id that names no block yet in `text`: six letters and digits. */
export function newBlockId(text: string): string {
  const taken = new Set(noteBlocks(text).map((block) => block.id));
  for (;;) {
    const id = Math.random().toString(36).slice(2, 8);
    if (id.length === 6 && !taken.has(id) && !text.includes(`^${id}`)) {
      return id;
    }
  }
}

/**
 * `text` with the id `id` given to `block`, a block `noteBlocks` found in
 * it: " ^id" at the end of its text, or "^id" on a line of its own under
 * a table, a quote or a code block, with a blank line after it if text
 * follows at once.
 */
export function withBlockId(
  text: string,
  block: NoteBlock,
  id: string,
): string {
  const { idAt } = block;
  if (!block.idOwnLine) {
    return `${text.slice(0, idAt)} ^${id}${text.slice(idAt)}`;
  }
  const rest = text.slice(idAt);
  const nextLine = /^\r?\n([^\r\n]*)/.exec(rest)?.[1];
  const gap = nextLine !== undefined && nextLine.trim() !== "" ? "\n" : "";
  return `${text.slice(0, idAt)}\n^${id}${gap}${rest}`;
}

interface FoundId {
  id: string;
  /** The block it names. */
  from: number;
  to: number;
}

/** The ids of a note by the start of the block each names. */
function idsOf(body: string, tree: Tree): Map<number, FoundId> {
  const ids = new Map<number, FoundId>();
  tree.iterate({
    enter({ name, node }) {
      if (name !== "BlockId") return;
      const block = blockOf(body, node);
      if (block !== null && !ids.has(block.from)) {
        const id = body.slice(node.from + 1, node.to);
        ids.set(block.from, { id, ...block });
      }
      return false;
    },
  });
  return ids;
}

/** The block an id node names, as `noteBlocks` counts blocks. */
function blockOf(body: string, id: SyntaxNode): FragmentRange | null {
  const parent = id.parent;
  if (parent === null) return null;
  const lineStart = body.lastIndexOf("\n", id.from - 1) + 1;
  const ownLine = body.slice(lineStart, id.from).trim() === "";
  const before = (at: number) => body.slice(0, at).trimEnd().length;

  if (parent.name === "TableCell") {
    // "^id" under a table is read as a row of it with one cell.
    const row = parent.parent;
    const table = row?.parent;
    if (row?.name !== "TableRow" || table?.name !== "Table") return null;
    if (row.getChildren("TableCell").length !== 1) return null;
    return { from: table.from, to: before(row.from) };
  }
  if (parent.name !== "Paragraph") return null;
  const quote = outermostQuote(parent);
  if (standaloneId(body, parent) !== null) {
    // Alone in its paragraph: the block before it, if any.
    let previous = parent.prevSibling;
    while (
      previous !== null &&
      !KINDS.has(previous.name) &&
      !previous.name.endsWith("List")
    ) {
      previous = previous.prevSibling;
    }
    if (previous === null) return quote ?? null;
    if (previous.name.endsWith("List")) {
      const last = previous.lastChild;
      return last === null ? null : { from: last.from, to: last.to };
    }
    return { from: previous.from, to: previous.to };
  }
  if (quote !== null) {
    return { from: quote.from, to: ownLine ? before(lineStart) : quote.to };
  }
  const item = parent.parent;
  if (item?.name === "ListItem" && firstParagraph(item)?.from === parent.from) {
    return { from: item.from, to: item.to };
  }
  return { from: parent.from, to: ownLine ? before(lineStart) : parent.to };
}

/** The id of a paragraph that holds nothing else, or `null`. */
function standaloneId(body: string, paragraph: SyntaxNode): string | null {
  const id = paragraph.firstChild;
  if (id?.name !== "BlockId") return null;
  if (
    body.slice(paragraph.from, paragraph.to).trim() !==
    body.slice(id.from, id.to)
  ) {
    return null;
  }
  return body.slice(id.from + 1, id.to);
}

function firstParagraph(item: SyntaxNode): SyntaxNode | null {
  for (let child = item.firstChild; child !== null; child = child.nextSibling) {
    if (child.name === "Paragraph") return child;
    if (child.name !== "ListMark" && child.name !== "Task") return null;
  }
  return null;
}

/** The quote `node` is in, the outer one of quotes in quotes, or `null`. */
function outermostQuote(node: SyntaxNode): SyntaxNode | null {
  let quote: SyntaxNode | null = null;
  for (let at = node.parent; at !== null; at = at.parent) {
    if (at.name === "Blockquote") quote = at;
  }
  return quote;
}

/** A block on one line for a list: its words, without marks and its id. */
function labelOf(markdown: string): string {
  const text = markdown
    .replace(/(^|\s)\^[A-Za-z0-9-]+\s*$/, "")
    .replace(/^\s*(?:>\s?)+/gm, "")
    .replace(/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/^\s*(```+|~~~+).*$/gm, "")
    .replace(/^\s*\[!\w+\][+-]?\s*/gm, "")
    .replace(/[*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/** The text with its frontmatter turned into spaces, offsets kept. */
function blankFrontmatter(text: string): string {
  const found = findFrontmatter(text);
  if (found === null) return text;
  return found.block.replace(/[^\r\n]/g, " ") + text.slice(found.block.length);
}
