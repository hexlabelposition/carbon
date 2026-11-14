/**
 * A word as the FTS5 tokenizer `unicode61` sees one: letters, digits and
 * the marks on them. Everything else separates words.
 */
const WORD = /[\p{L}\p{N}\p{M}]+/gu;

/** The words of what the user typed, as the search takes them. */
export function queryWords(text: string): string[] {
  return text.match(WORD) ?? [];
}

/**
 * The FTS5 query for what the user typed, or `null` if it has no words.
 * Every word must occur, as a word or the start of one, so a word being
 * typed already finds something. Each is quoted: what the user types is
 * never read as FTS5 syntax, so `OR`, `-`, `"` or `title:` are plain text.
 * Operators of our own are C-308.
 */
export function fullTextQuery(text: string): string | null {
  const words = queryWords(text);
  if (words.length === 0) return null;
  return words.map((word) => `"${word}"*`).join(" ");
}
