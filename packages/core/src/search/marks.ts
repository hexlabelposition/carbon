import type { TextRange } from "../types";

/**
 * What FTS5 puts around a match in `highlight()` and `snippet()`: control
 * characters, which note text does not have. A stray one in a note only
 * moves a highlight, it loses no text.
 */
export const MATCH_START = "\u0002";
export const MATCH_END = "\u0003";

/** Text with the matches marked, as FTS5 gives it, read apart. */
export interface MarkedText {
  text: string;
  matches: TextRange[];
}

/**
 * Takes the marks out of `marked` and tells where the parts between them
 * are. With `oneLine`, every run of white space becomes one space and none
 * is left at the ends: a snippet of a note keeps one block per line.
 */
export function readMarks(marked: string, oneLine = false): MarkedText {
  let text = "";
  const matches: TextRange[] = [];
  let start: number | null = null;
  // A space seen but not written: it is dropped at the ends.
  let space = false;
  const flushSpace = () => {
    if (space && text !== "") text += " ";
    space = false;
  };

  for (const char of marked) {
    if (char === MATCH_START) {
      flushSpace();
      start = text.length;
    } else if (char === MATCH_END) {
      if (start !== null && text.length > start) {
        matches.push({ start, end: text.length });
      }
      start = null;
    } else if (oneLine && /\s/.test(char)) {
      space = true;
    } else {
      flushSpace();
      text += char;
    }
  }
  return { text, matches };
}
