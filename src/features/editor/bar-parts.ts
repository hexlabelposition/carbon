import { preference, type Preference } from "../settings/preference";

/**
 * The parts of a bar of a note hidden from its right-click menu, stored
 * under `key`: only those among `parts`, in their order.
 */
function hiddenParts<P extends string>(
  key: string,
  parts: readonly P[],
): Preference<readonly P[]> {
  return preference<readonly P[]>(
    key,
    [],
    (stored) => {
      try {
        const value: unknown = JSON.parse(stored);
        return Array.isArray(value)
          ? parts.filter((part) => value.includes(part))
          : undefined;
      } catch {
        return undefined;
      }
    },
    (value) => JSON.stringify(value),
  );
}

/** Shows `part` on its bar, or hides it. */
export function setPartShown<P extends string>(
  hidden: Preference<readonly P[]>,
  part: P,
  shown: boolean,
): void {
  const rest = hidden.get().filter((other) => other !== part);
  hidden.set(shown ? rest : [...rest, part]);
}

/** What the bar below a note can show, each of which can be hidden. */
export type StatsPart = "save" | "words" | "characters" | "minutes";

/** In the order the bar and its menu show them. */
export const STATS_PARTS: readonly StatsPart[] = [
  "save",
  "words",
  "characters",
  "minutes",
];

/**
 * The parts hidden from the bar below a note. Hiding "save" hides only
 * that the note is saved or being saved: a save that failed or a
 * conflict is always told.
 */
export const hiddenStatsPreference = hiddenParts(
  "carbon.note.hiddenStats",
  STATS_PARTS,
);

/**
 * What the bar above a note can show besides its name, each of which can
 * be hidden: back and forward, the folder before the name, the format
 * button, the button of the formatting bar and the menu of the mode.
 */
export type HeaderPart = "history" | "path" | "format" | "formatBar" | "mode";

/** In the order the bar and its menu show them. */
export const HEADER_PARTS: readonly HeaderPart[] = [
  "history",
  "path",
  "format",
  "formatBar",
  "mode",
];

/**
 * The parts hidden from the bar above a note. The name stays: it is
 * where the note is renamed.
 */
export const hiddenHeaderPreference = hiddenParts(
  "carbon.note.hiddenHeader",
  HEADER_PARTS,
);
