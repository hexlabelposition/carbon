import { markdownParser, withoutFrontmatter } from "../parser/parse-note";
import { fold, spellings } from "../search/fold";
import { queryWords } from "../search/query";
import type { TextRange } from "../types";

/**
 * Nodes whose text cannot become a link: links themselves, code, web
 * addresses and HTML. A mention inside one is left alone.
 */
const NO_LINK = new Set([
  "WikiLink",
  "Link",
  "Image",
  "URL",
  "Autolink",
  "InlineCode",
  "FencedCode",
  "CodeBlock",
  "HTMLTag",
  "HTMLBlock",
  "Comment",
  "CommentBlock",
  "ProcessingInstruction",
  "ProcessingInstructionBlock",
  "LinkReference",
]);

/** Characters of context kept on each side of a mention in its snippet. */
const SNIPPET_CONTEXT = 60;

/** A mention of a note in the text of another, without a link. */
export interface FoundMention extends TextRange {
  /** The line around the mention, cut short far from it. */
  snippet: string;
  /** Where the mention is in `snippet`. */
  snippetMatch: TextRange;
}

/**
 * The FTS5 query for notes whose body has `title` as a phrase, in every
 * spelling of its look-alike letters; `null` if the title has no words.
 * It finds candidates: `findMentions` tells which really mention it.
 */
export function mentionQuery(title: string): string | null {
  const words = queryWords(title);
  if (words.length === 0) return null;
  const phrases = spellings(words.join(" ")).map((phrase) => `"${phrase}"`);
  return `body : (${phrases.join(" OR ")})`;
}

/**
 * Where `text` mentions `title` as plain text: as whole words, compared as
 * the index compares words (`fold`), any run of spaces or tabs for one
 * space. Not in the frontmatter, and not where a link cannot go
 * (`NO_LINK`), such as inside a link or code.
 */
export function findMentions(text: string, title: string): FoundMention[] {
  const name = fold(title.trim()).text;
  if (queryWords(name).length === 0) return [];
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}\\p{M}])${name
      .split(/\s+/)
      .map(escape)
      .join("[ \\t]+")}(?![\\p{L}\\p{N}\\p{M}])`,
    "gu",
  );
  const body = withoutFrontmatter(text);
  const folded = fold(body);
  const blocked = noLinkRanges(body);
  const mentions: FoundMention[] = [];
  for (const match of folded.text.matchAll(pattern)) {
    const start = folded.offsets[match.index];
    const after = match.index + match[0].length;
    // A mark after the last letter belongs to it.
    const end =
      after < folded.offsets.length ? folded.offsets[after] : body.length;
    if (blocked.some((r) => r.start < end && start < r.end)) continue;
    mentions.push({ start, end, ...snippetAround(body, start, end) });
  }
  return mentions;
}

function noLinkRanges(body: string): TextRange[] {
  const ranges: TextRange[] = [];
  markdownParser.parse(body).iterate({
    enter({ name, from, to }) {
      if (!NO_LINK.has(name)) return;
      ranges.push({ start: from, end: to });
      return false;
    },
  });
  return ranges;
}

/** The line of `body` around `start` to `end`, cut short far from it. */
function snippetAround(
  body: string,
  start: number,
  end: number,
): Pick<FoundMention, "snippet" | "snippetMatch"> {
  const lineStart = body.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = body.indexOf("\n", end);
  let from = Math.max(lineStart, start - SNIPPET_CONTEXT);
  const to = Math.min(
    lineEnd === -1 ? body.length : lineEnd,
    end + SNIPPET_CONTEXT,
  );
  while (from < start && /\s/.test(body[from])) from++;
  const head = from > lineStart ? "…" : "";
  const tail = to < (lineEnd === -1 ? body.length : lineEnd) ? "…" : "";
  const snippet = head + body.slice(from, to).trimEnd() + tail;
  const at = head.length + start - from;
  return { snippet, snippetMatch: { start: at, end: at + end - start } };
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
