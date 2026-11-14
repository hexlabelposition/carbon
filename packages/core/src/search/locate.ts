import { withoutFrontmatter } from "../parser/parse-note";
import { queryWords } from "./query";

/**
 * Where a note first has a word of what the user searched for: a word
 * that starts with one of them, ignoring case, as the search finds them.
 * The frontmatter is skipped, as the index skips it. `null` if the body
 * has none, such as when only the title matched.
 *
 * Markdown syntax is not skipped: a word inside the address of a link
 * counts, though the index leaves it out. Letters with diacritics must
 * match exactly here, while the index may ignore them.
 */
export function firstMatch(text: string, query: string): number | null {
  const words = queryWords(query);
  if (words.length === 0) return null;
  // At the start of a word: nothing of a word just before. The words
  // are letters, digits and marks only, so none needs escaping.
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}\\p{M}])(?:${words.join("|")})`,
    "iu",
  );
  return pattern.exec(withoutFrontmatter(text))?.index ?? null;
}
