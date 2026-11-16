import { matchKey } from "../links/resolve";
import { spellings } from "./fold";

/**
 * A word as the FTS5 tokenizer `unicode61` sees one: letters, digits and
 * the marks on them. Everything else separates words.
 */
const WORD = /[\p{L}\p{N}\p{M}]+/gu;

/** The words of a text, as the search takes them. */
export function queryWords(text: string): string[] {
  return text.match(WORD) ?? [];
}

/** What the user typed, read apart. */
export interface ParsedQuery {
  /** Words to find, each as a word or the start of one. */
  words: string[];
  /**
   * Words to find together and in order, from `"exact phrase"`. A phrase
   * whose closing quote is not typed yet is `open`: its last word may be
   * the start of one, as with `words`.
   */
  phrases: { words: string[]; open: boolean }[];
  /** Text the path of a note must have, from `path:folder`. */
  paths: string[];
  /**
   * Starts of tags a note must have, from `tag:name`, without "#": as
   * with words, a tag being typed already finds something.
   */
  tags: string[];
}

/**
 * `path:` with a quoted or a plain value, `tag:` with a plain one, a
 * quoted phrase, or anything up to the next space. A quote that is not
 * closed runs to the end.
 */
const PART = /path:(?:"([^"]*)"?|(\S*))|tag:(\S*)|"([^"]*)("?)|(\S+)/giu;

/**
 * Reads what the user typed into its parts: words, `"exact phrases"`,
 * `path:` filters, as `path:projects` or `path:"my notes"`, and `tag:`
 * filters, as `tag:idea` or `tag:#area/topic`. Operators that are not
 * known are plain words: `title:x` is the words "title" and "x".
 */
export function parseQuery(text: string): ParsedQuery {
  const query: ParsedQuery = { words: [], phrases: [], paths: [], tags: [] };
  for (const match of text.matchAll(PART)) {
    const [, quotedPath, plainPath, tag, phrase, closed, plain] = match;
    if (quotedPath !== undefined || plainPath !== undefined) {
      const path = (quotedPath ?? plainPath).trim();
      if (path !== "") query.paths.push(path);
    } else if (tag !== undefined) {
      const name = tag.replace(/^#/, "");
      if (name !== "") query.tags.push(name);
    } else if (phrase !== undefined) {
      const words = queryWords(phrase);
      if (words.length > 0) query.phrases.push({ words, open: closed === "" });
    } else {
      query.words.push(...queryWords(plain));
    }
  }
  return query;
}

/** A search as the index runs it. */
export interface FullTextQuery {
  /** The FTS5 query, or `null` to filter by path and tags alone. */
  match: string | null;
  /** Text the path key of a note must have (`matchKey`). */
  paths: string[];
  /** Starts of the keys of tags a note must have (`matchKey`). */
  tags: string[];
}

/**
 * The search for what the user typed (`parseQuery`), or `null` if it asks
 * for nothing. Every word must occur, as a word or the start of one, so a
 * word being typed already finds something; every phrase as written; each
 * in any of its `spellings`. Words are quoted: what the user types is
 * never read as FTS5 syntax, so `OR`, `-` or `NEAR` are plain text.
 */
export function fullTextQuery(text: string): FullTextQuery | null {
  const { words, phrases, paths, tags } = parseQuery(text);
  const terms = [
    ...words.map((word) => anyOf(spellings(word), "*")),
    ...phrases.map((phrase) =>
      anyOf(spellings(phrase.words.join(" ")), phrase.open ? "*" : ""),
    ),
  ];
  if (terms.length === 0 && paths.length === 0 && tags.length === 0) {
    return null;
  }
  return {
    // Spelled out: FTS5 takes no implicit AND next to parentheses.
    match: terms.length === 0 ? null : terms.join(" AND "),
    paths: paths.map(matchKey),
    tags: tags.map(matchKey),
  };
}

/** `"a"*`, or `("a"* OR "b"*)` for more than one spelling. */
function anyOf(spellings: string[], suffix: string): string {
  const terms = spellings.map((spelling) => `"${spelling}"${suffix}`);
  return terms.length === 1 ? terms[0] : `(${terms.join(" OR ")})`;
}
