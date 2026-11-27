import { preference } from "../settings/preference";

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
 * The parts hidden from the bar below a note, from its right-click menu.
 * Hiding "save" hides only that the note is saved or being saved: a save
 * that failed or a conflict is always told.
 */
export const hiddenStatsPreference = preference<readonly StatsPart[]>(
  "carbon.note.hiddenStats",
  [],
  (stored) => {
    try {
      const value: unknown = JSON.parse(stored);
      return Array.isArray(value)
        ? STATS_PARTS.filter((part) => value.includes(part))
        : undefined;
    } catch {
      return undefined;
    }
  },
  (value) => JSON.stringify(value),
);

/** Shows `part` on the bar below a note, or hides it. */
export function setStatsPartShown(part: StatsPart, shown: boolean): void {
  const hidden = hiddenStatsPreference.get().filter((other) => other !== part);
  hiddenStatsPreference.set(shown ? hidden : [...hidden, part]);
}
