import type { FileTimes } from "@carbon/core";
import { oneOf, preference } from "../settings/preference";
import { byName } from "../vault/by-name";
import { entryLabel } from "../vault/place";

/** How the bookmarks are ordered, and which way. */
export type BookmarkSort =
  | "added-desc"
  | "added-asc"
  | "name-asc"
  | "name-desc"
  | "modified-desc"
  | "modified-asc";

/** In the order the sort menu lists them, a pair to each key. */
export const BOOKMARK_SORTS: readonly BookmarkSort[] = [
  "added-desc",
  "added-asc",
  "name-asc",
  "name-desc",
  "modified-desc",
  "modified-asc",
];

/**
 * The order of the bookmarks: in the order they were added, as they
 * always were, until another is picked from their sort button.
 */
export const bookmarkSortPreference = preference<BookmarkSort>(
  "carbon.bookmarks.sort",
  "added-asc",
  oneOf(BOOKMARK_SORTS),
);

/**
 * `paths`, the bookmarks in the order they were added, in the order of
 * `sort`. By name as the list shows it (a note without its `.md`), A to Z
 * or Z to A, those of the same name by where they are. By the time a file
 * was last changed, the newest or the oldest first: a file with no time
 * known goes last either way, and those of the same time go A to Z.
 */
export function sortBookmarks(
  paths: readonly string[],
  sort: BookmarkSort,
  times: ReadonlyMap<string, FileTimes>,
): readonly string[] {
  if (sort === "added-asc") return paths;
  if (sort === "added-desc") return [...paths].reverse();
  const names = (a: string, b: string) =>
    byName.compare(entryLabel(a), entryLabel(b)) || byName.compare(a, b);
  if (sort === "name-asc") return [...paths].sort(names);
  if (sort === "name-desc") return [...paths].sort((a, b) => names(b, a));
  const newest = sort === "modified-desc";
  return [...paths].sort((a, b) => {
    const at = times.get(a)?.modified;
    const bt = times.get(b)?.modified;
    if (at === undefined || bt === undefined) {
      if (at !== bt) return at === undefined ? 1 : -1;
    } else if (at !== bt) {
      return newest ? bt - at : at - bt;
    }
    return names(a, b);
  });
}
