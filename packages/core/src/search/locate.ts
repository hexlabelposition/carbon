import { withoutFrontmatter } from "../parser/parse-note";
import { fold } from "./fold";
import { queryWords } from "./query";

/**
 * Where a note first has a word of what the user searched for: a word
 * that starts with one of them, compared as the index compares words
 * (`fold`): case, the diacritics of Latin letters and look-alike letters
 * such as "е" and "ё" do not matter. The frontmatter is skipped, as the
 * index skips it. `null` if the body has none, such as when only the
 * title matched.
 *
 * Markdown syntax is not skipped: a word inside the address of a link
 * counts, though the index leaves it out.
 */
export function firstMatch(text: string, query: string): number | null {
  const words = queryWords(query).map((word) => fold(word).text);
  if (words.length === 0) return null;
  const body = fold(withoutFrontmatter(text));
  // At the start of a word: nothing of a word just before. The words
  // are letters, digits and marks only, so none needs escaping.
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}\\p{M}])(?:${words.join("|")})`,
    "u",
  );
  const index = pattern.exec(body.text)?.index;
  return index === undefined ? null : body.offsets[index];
}
