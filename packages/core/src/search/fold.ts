/**
 * Letters the FTS5 tokenizer keeps apart that people write one for the
 * other: Russian "ё" is mostly written "е", and Polish "ł" is typed "l"
 * without a Polish layout. Each is a pair of a plain letter and its
 * look-alike, in lower case.
 */
const LOOKALIKES: ReadonlyMap<string, string> = new Map([
  ["е", "ё"],
  ["l", "ł"],
]);
/** Each letter of a pair, to the plain one. */
const TO_PLAIN: ReadonlyMap<string, string> = new Map(
  [...LOOKALIKES].flatMap(([plain, alike]) => [
    [plain, plain],
    [alike, plain],
  ]),
);

/** Spellings tried for one word at most; past that, fewer, see `spellings`. */
const MAX_SPELLINGS = 8;

/**
 * The spellings of a word to search for: in lower case, with every
 * letter of a look-alike pair as either letter, so "елка" also finds
 * "ёлка" and "lodz" also finds "Łódź". A word with many such letters gets
 * only three: as typed, all plain and all look-alike.
 */
export function spellings(word: string): string[] {
  const letters = [...word.toLowerCase()];
  const at = letters.flatMap((letter, i) => (TO_PLAIN.has(letter) ? [i] : []));
  if (at.length === 0) return [letters.join("")];

  const pairOf = (i: number) => {
    const plain = TO_PLAIN.get(letters[i]) ?? letters[i];
    return [plain, LOOKALIKES.get(plain) ?? plain];
  };
  if (2 ** at.length > MAX_SPELLINGS) {
    const all = (side: 0 | 1) =>
      letters.map((l, i) => (at.includes(i) ? pairOf(i)[side] : l)).join("");
    return [...new Set([letters.join(""), all(0), all(1)])];
  }
  let result = [letters];
  for (const i of at) {
    result = result.flatMap((spelling) =>
      pairOf(i).map((letter) => {
        const next = [...spelling];
        next[i] = letter;
        return next;
      }),
    );
  }
  return result.map((spelling) => spelling.join(""));
}

/** A text folded for matching, and where each of its units came from. */
export interface FoldedText {
  text: string;
  /** For each UTF-16 unit of `text`, its offset in the original text. */
  offsets: number[];
}

/**
 * The text as the index compares it, for finding in JavaScript what the
 * index found: in lower case, without the diacritics of Latin letters
 * (`remove_diacritics` of `unicode61`), and with look-alike letters made
 * plain. Letters of other scripts keep their marks: "й" stays apart from
 * "и", and "ї" from "і".
 */
export function fold(text: string): FoldedText {
  let folded = "";
  const offsets: number[] = [];
  let at = 0;
  let latinBefore = false;
  for (const char of text) {
    let part: string;
    if (/\p{M}/u.test(char)) {
      // A mark on its own, after a letter written decomposed.
      part = latinBefore ? "" : char;
    } else {
      latinBefore = /\p{Script=Latin}/u.test(char);
      part = char.toLowerCase();
      if (latinBefore) part = part.normalize("NFD").replace(/\p{M}/gu, "");
      part = [...part].map((c) => TO_PLAIN.get(c) ?? c).join("");
    }
    folded += part;
    for (let i = 0; i < part.length; i++) offsets.push(at);
    at += char.length;
  }
  return { text: folded, offsets };
}
