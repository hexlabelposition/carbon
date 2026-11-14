import type { SyntaxNode } from "@lezer/common";
import { Emoji, GFM, parser, Subscript, Superscript } from "@lezer/markdown";
import type { Heading, Link, NotePath, ParsedNote, TextRange } from "../types";
import { wikiLink } from "./wiki-link";

/**
 * The Markdown grammar of Carbon: the one the editor uses (GFM with
 * subscript, superscript and emoji, as in `@codemirror/lang-markdown`)
 * plus wiki links (ADR-012).
 */
export const markdownParser = parser.configure([
  GFM,
  Subscript,
  Superscript,
  Emoji,
  wikiLink,
]);

/**
 * What the index needs to know about a note. A pure function: no I/O, so
 * it runs in a Web Worker and in tests.
 *
 * - `title`: the file name without `.md`. Links are resolved by it, and
 *   the tabs and the file tree show it.
 * - `headings`: every heading, also in quotes and lists, as text.
 * - `links`: wiki links, and Markdown links to local `.md` files, in the
 *   order they are written, with the text around them. A Markdown link
 *   keeps its address as written, relative to the note; resolving it is
 *   for the links module.
 * - `plainText`: the body without Markdown syntax, one block per line.
 *
 * Frontmatter is left out of everything. Tags, aliases and properties stay
 * empty until they are parsed (C-401, C-402).
 */
export function parseNote(path: NotePath, text: string): ParsedNote {
  // Read from `body` everywhere: it has the offsets of `text`, and blanks
  // where the frontmatter was.
  const body = withoutFrontmatter(text);
  const tree = markdownParser.parse(body);
  const read = new Reader(body);
  const references = linkReferences(body, tree.topNode);

  const headings: Heading[] = [];
  const links: Link[] = [];
  tree.iterate({
    enter({ name, node }) {
      const level = HEADING.exec(name)?.[1];
      if (level !== undefined) {
        headings.push({
          level: Number(level),
          text: read.inline(node),
          pos: node.from,
        });
      } else if (name === "WikiLink") {
        links.push({
          ...readWikiLink(body, node),
          snippet: snippetOf(read, node),
        });
      } else if (name === "Link") {
        const link = readMarkdownLink(body, node, references, read);
        if (link !== null)
          links.push({ ...link, snippet: snippetOf(read, node) });
      }
    },
  });

  return {
    path,
    title: titleOf(path),
    headings,
    links,
    tags: [],
    aliases: [],
    properties: {},
    plainText: read.plain(tree.topNode),
  };
}

const HEADING = /^(?:ATX|Setext)Heading([1-6])$/;

export function titleOf(path: NotePath): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

/**
 * The text with its frontmatter turned into spaces. The offsets stay
 * those of the text, and the parser sees blank lines where the
 * frontmatter was: without this, "---" under a line of YAML makes that
 * line a heading.
 */
export function withoutFrontmatter(text: string): string {
  const match =
    /^---[ \t]*\r?\n(?:.*\r?\n)*?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
  if (match === null) return text;
  const blank = match[0].replace(/[^\r\n]/g, " ");
  return blank + text.slice(match[0].length);
}

/** A link as it is written; the snippet comes from the whole note. */
type WrittenLink = Omit<Link, "snippet">;

function readWikiLink(text: string, node: SyntaxNode): WrittenLink {
  const part = (name: string) => {
    const child = node.getChild(name);
    const value = child === null ? "" : text.slice(child.from, child.to).trim();
    return value === "" ? null : value;
  };
  return {
    kind: "wiki",
    // Empty for a heading of the same note: "[[#Heading]]".
    target: part("WikiLinkTarget") ?? "",
    alias: part("WikiLinkAlias"),
    fragment: part("WikiLinkFragment"),
    start: node.from,
    end: node.to,
  };
}

/**
 * A Markdown link to a local note: `[text](Note.md)`, `[text](../a b.md)`
 * written as `<../a b.md>` or `../a%20b.md`, `[text](Note.md#Heading)`,
 * and the reference forms `[text][ref]`, `[ref][]` and `[ref]`. `null` for
 * links to the web, to other files, and to unknown references.
 */
function readMarkdownLink(
  text: string,
  node: SyntaxNode,
  references: References,
  read: Reader,
): WrittenLink | null {
  const marks = node.getChildren("LinkMark");
  const url = addressOf(text, node, references);
  if (url === null) return null;

  let address = text.slice(url.from, url.to);
  address = decode(address.replace(/^<(.*)>$/, "$1"));
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(address)) return null;
  const hash = address.indexOf("#");
  const target = (hash === -1 ? address : address.slice(0, hash)).trim();
  if (!/\.md$/i.test(target)) return null;
  const fragment = hash === -1 ? "" : address.slice(hash + 1).trim();

  const alias = read.inlineBetween(node, marks[0].to, marks[1].from);
  return {
    kind: "markdown",
    target,
    alias: alias === "" ? null : alias,
    fragment: fragment === "" ? null : fragment,
    start: node.from,
    end: node.to,
  };
}

/** Characters of context kept on each side of a link in its snippet. */
const SNIPPET_CONTEXT = 80;

/** The blocks a snippet is the text of; a table cell is too short. */
const SNIPPET_BLOCKS = new Set([
  "Paragraph",
  "ATXHeading1",
  "ATXHeading2",
  "ATXHeading3",
  "ATXHeading4",
  "ATXHeading5",
  "ATXHeading6",
  "SetextHeading1",
  "SetextHeading2",
  "TableHeader",
  "TableRow",
]);

/** See `Link.snippet`. */
function snippetOf(read: Reader, link: SyntaxNode): string {
  let block = link.parent;
  while (block !== null && !SNIPPET_BLOCKS.has(block.name)) {
    block = block.parent;
  }
  const [before, text, after] = read.around(block ?? link, link);
  const collapse = (part: string) => part.replace(/\s+/g, " ");
  return (
    clipStart(collapse(before).trimStart()) +
    collapse(text) +
    clipEnd(collapse(after).trimEnd())
  );
}

/** The end of `text`, cut at a space when it is too long. */
function clipStart(text: string): string {
  if (text.length <= SNIPPET_CONTEXT) return text;
  const kept = text.slice(-SNIPPET_CONTEXT);
  const space = kept.indexOf(" ");
  return `…${space === -1 ? kept : kept.slice(space + 1)}`;
}

/** The start of `text`, cut at a space when it is too long. */
function clipEnd(text: string): string {
  if (text.length <= SNIPPET_CONTEXT) return text;
  const kept = text.slice(0, SNIPPET_CONTEXT);
  const space = kept.lastIndexOf(" ");
  return `${space === -1 ? kept : kept.slice(0, space)}…`;
}

/** The address nodes of `[ref]: address` definitions, by normalized label. */
type References = Map<string, SyntaxNode>;

function linkReferences(text: string, top: SyntaxNode): References {
  const references: References = new Map();
  for (const node of top.getChildren("LinkReference")) {
    const label = node.getChild("LinkLabel");
    const url = node.getChild("URL");
    if (label === null || url === null) continue;
    const key = referenceKey(text.slice(label.from, label.to));
    // The first definition of a label wins, as in CommonMark.
    if (!references.has(key)) references.set(key, url);
  }
  return references;
}

/**
 * The address node of a Markdown link: its own, or the one in the
 * definition of its reference. `null` without an address.
 */
function addressOf(
  text: string,
  link: SyntaxNode,
  references: References,
): SyntaxNode | null {
  const marks = link.getChildren("LinkMark");
  // "[" and "]" around the text are the first two marks.
  if (marks.length < 2) return null;
  const url = link.getChild("URL");
  if (url !== null) return url;
  const reference = link.getChild("LinkLabel");
  const label =
    reference !== null && reference.to - reference.from > 2
      ? text.slice(reference.from, reference.to)
      : text.slice(marks[0].to, marks[1].from);
  return references.get(referenceKey(label)) ?? null;
}

/**
 * Where the target of each link is written, by the start of the link: the
 * text to replace to point the link elsewhere. For a wiki link it is the
 * note name, without the heading and the alias; for a Markdown link the
 * whole address, `<...>` and heading included, which for a link by
 * reference is in the definition, shared with other links. A wiki link
 * without a target, `[[#Heading]]`, has none.
 */
export function linkTargets(text: string): Map<number, TextRange> {
  const body = withoutFrontmatter(text);
  const tree = markdownParser.parse(body);
  const references = linkReferences(body, tree.topNode);
  const targets = new Map<number, TextRange>();
  tree.iterate({
    enter({ name, node }) {
      const part =
        name === "WikiLink"
          ? node.getChild("WikiLinkTarget")
          : name === "Link"
            ? addressOf(body, node, references)
            : null;
      if (part !== null)
        targets.set(node.from, { start: part.from, end: part.to });
    },
  });
  return targets;
}

/** CommonMark matches labels case-insensitively, with spaces collapsed. */
function referenceKey(label: string): string {
  return label
    .replace(/^\[|\]$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function decode(address: string): string {
  try {
    return decodeURIComponent(address);
  } catch {
    // A "%" that starts no escape: the address is taken as written.
    return address;
  }
}

/** Nodes whose text is syntax, not content. */
const SYNTAX = new Set([
  "HeaderMark",
  "EmphasisMark",
  "CodeMark",
  "CodeInfo",
  "StrikethroughMark",
  "SubscriptMark",
  "SuperscriptMark",
  "LinkMark",
  "LinkLabel",
  "URL",
  "LinkTitle",
  "QuoteMark",
  "ListMark",
  "TaskMarker",
  "TableDelimiter",
  "HorizontalRule",
  "HTMLTag",
  "Comment",
  "CommentBlock",
  "ProcessingInstruction",
  "ProcessingInstructionBlock",
  "LinkReference",
]);

/** Nodes that start a line of their own in the plain text. */
const BLOCKS = new Set([
  "Paragraph",
  "ATXHeading1",
  "ATXHeading2",
  "ATXHeading3",
  "ATXHeading4",
  "ATXHeading5",
  "ATXHeading6",
  "SetextHeading1",
  "SetextHeading2",
  "FencedCode",
  "CodeBlock",
  "HTMLBlock",
  "TableHeader",
  "TableRow",
  "TableCell",
  "ListItem",
]);

/** Put around the marked node by `Reader.around`; not in any note. */
const OPEN = "\u{F0000}";
const CLOSE = "\u{F0001}";

/** Reads the text of nodes without their Markdown syntax. */
class Reader {
  /** The node `around` looks for. */
  private mark: SyntaxNode | null = null;

  constructor(private readonly text: string) {}

  /**
   * The text of `block`, split into what comes before `node`, the text of
   * `node`, and what comes after. Whitespace is kept as it is.
   */
  around(block: SyntaxNode, node: SyntaxNode): [string, string, string] {
    const out: string[] = [];
    this.mark = node;
    if (block === node) this.read(node, out);
    else this.collect(block, out, block.from, block.to);
    this.mark = null;
    const [before, rest = ""] = out.join("").split(OPEN);
    const [text, after = ""] = rest.split(CLOSE);
    return [before, text, after];
  }

  /** The text of an inline run, such as a heading, on one line. */
  inline(node: SyntaxNode): string {
    return this.inlineBetween(node, node.from, node.to);
  }

  /** The same, for the part of `node` between two offsets. */
  inlineBetween(node: SyntaxNode, from: number, to: number): string {
    const out: string[] = [];
    this.collect(node, out, from, to);
    return out.join("").replace(/\s+/g, " ").trim();
  }

  /** The text of a whole note: each block on a line, no blank lines. */
  plain(top: SyntaxNode): string {
    const out: string[] = [];
    this.collect(top, out, top.from, top.to);
    return out
      .join("")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .filter((line) => line !== "")
      .join("\n");
  }

  private collect(node: SyntaxNode, out: string[], from: number, to: number) {
    let at = from;
    const text = (end: number) => {
      if (end > at) out.push(this.text.slice(at, end));
    };
    for (
      let child = node.firstChild;
      child !== null;
      child = child.nextSibling
    ) {
      if (child.to <= from) continue;
      if (child.from >= to) break;
      text(child.from);
      at = child.to;
      const block = BLOCKS.has(child.name);
      if (block) out.push("\n");
      this.read(child, out);
      if (block) out.push("\n");
    }
    text(to);
  }

  /** Puts what `node` reads as into `out`. */
  private read(node: SyntaxNode, out: string[]) {
    const mark = this.mark;
    if (
      mark !== null &&
      node.name === mark.name &&
      node.from === mark.from &&
      node.to === mark.to
    ) {
      this.mark = null;
      out.push(OPEN);
      this.read(node, out);
      out.push(CLOSE);
      return;
    }
    const source = this.text.slice(node.from, node.to);
    switch (node.name) {
      case "HardBreak":
        // A line break inside a paragraph: the words stay apart.
        out.push(" ");
        return;
      case "Link":
      case "Image": {
        // Only the text between "[" and "]"; the rest is the address.
        const marks = node.getChildren("LinkMark");
        if (marks.length >= 2) {
          this.collect(node, out, marks[0].to, marks[1].from);
        }
        return;
      }
      case "WikiLink":
        out.push(wikiLinkText(this.text, node));
        return;
      case "Escape":
        out.push(source.slice(1));
        return;
      case "Entity":
        out.push(decodeEntity(source));
        return;
    }
    if (!SYNTAX.has(node.name)) this.collect(node, out, node.from, node.to);
  }
}

/** What a wiki link reads as: its alias, or its note and heading. */
function wikiLinkText(text: string, link: SyntaxNode): string {
  const { target, fragment, alias } = readWikiLink(text, link);
  return alias ?? [target, fragment ?? ""].filter((part) => part).join(" ");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** `&amp;`, `&#35;`, `&#x23;`; names it does not know stay as written. */
function decodeEntity(entity: string): string {
  const body = entity.slice(1, -1);
  if (body.startsWith("#")) {
    const code =
      body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : entity;
  }
  return ENTITIES[body] ?? entity;
}
