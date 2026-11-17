/** What the bar below a note tells about its text, or about a part of it. */
export interface TextStats {
  words: number;
  /** Every character, spaces and line breaks among them. */
  characters: number;
  /** Characters that are not spaces or line breaks. */
  charactersNoSpaces: number;
  lines: number;
}

/** About a note: its text, and what is selected in it, if anything. */
export interface NoteStats {
  text: TextStats;
  /** `null` while nothing is selected. */
  selection: TextStats | null;
}

/** Words read in a minute, for the reading time. */
const WORDS_PER_MINUTE = 200;

/**
 * A word: letters and digits of any script, Cyrillic as Latin, with an
 * apostrophe or a hyphen inside ("don't", "из-за"). Markdown marks such as
 * "#", "*" and "[[" are no letters, so they count for nothing.
 */
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** The YAML block at the top of a note: properties, not text. */
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

/** Counts the text of a note, past its frontmatter. */
export function noteTextStats(text: string): TextStats {
  return textStats(text.replace(FRONTMATTER, ""));
}

/** Counts a piece of text as it is. */
export function textStats(text: string): TextStats {
  const words = text.match(WORD)?.length ?? 0;
  // By code points, not UTF-16 units: an emoji is one character, not two.
  let characters = 0;
  let spaces = 0;
  for (const char of text) {
    characters++;
    if (/\s/.test(char)) spaces++;
  }
  return {
    words,
    characters,
    charactersNoSpaces: characters - spaces,
    lines: text === "" ? 0 : text.split("\n").length,
  };
}

/** Minutes it takes to read so many words: at least one if there are any. */
export function readingMinutes(words: number): number {
  return words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
