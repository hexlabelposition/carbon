import { withoutFrontmatter } from "../parser/parse-note";
import { fold } from "./fold";
import { parseQuery } from "./query";

/** Letters, digits and marks: what words are made of. */
const WORD_CHAR = "[\\p{L}\\p{N}\\p{M}]";

/**
 * Where a note first has what the user searched for (`parseQuery`): a
 * word that starts with one of the words, or a phrase, compared as the
 * index compares words (`fold`): case, the diacritics of Latin letters
 * and look-alike letters such as "е" and "ё" do not matter. A `path:`
 * filter is not looked for. The frontmatter is skipped, as the index
 * skips it. `null` if the body has none, such as when only the title
 * matched.
 *
 * Markdown syntax is not skipped: a word inside the address of a link
 * counts, though the index leaves it out.
 */
export function firstMatch(text: string, query: string): number | null {
  const { words, phrases } = parseQuery(query);
  const folded = (word: string) => fold(word).text;
  // The words are letters, digits and marks only: none needs escaping.
  const alternatives = [
    ...words.map(folded),
    ...phrases.map(
      (phrase) =>
        phrase.words.map(folded).join(`(?:(?!${WORD_CHAR})[^\\n])+`) +
        (phrase.open ? "" : `(?!${WORD_CHAR})`),
    ),
  ];
  if (alternatives.length === 0) return null;
  const body = fold(withoutFrontmatter(text));
  // At the start of a word: nothing of a word just before.
  const pattern = new RegExp(
    `(?<!${WORD_CHAR})(?:${alternatives.join("|")})`,
    "u",
  );
  const index = pattern.exec(body.text)?.index;
  return index === undefined ? null : body.offsets[index];
}
