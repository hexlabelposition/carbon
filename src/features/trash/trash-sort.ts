import type { TrashItem } from "@carbon/core";
import { oneOf, preference } from "../settings/preference";
import { byName } from "../vault/by-name";
import { parentOf } from "../vault/paths";
import { entryLabel } from "../vault/place";

/** How the items of the trash are ordered, and which way. */
export type TrashSort =
  | "deleted-desc"
  | "deleted-asc"
  | "name-asc"
  | "name-desc"
  | "place-asc"
  | "place-desc";

/** In the order the sort menu lists them, a pair to each key. */
export const TRASH_SORTS: readonly TrashSort[] = [
  "deleted-desc",
  "deleted-asc",
  "name-asc",
  "name-desc",
  "place-asc",
  "place-desc",
];

/**
 * The order of the trash: the latest deleted first, as the core lists
 * it, until another is picked.
 */
export const trashSortPreference = preference<TrashSort>(
  "carbon.trash.sort",
  "deleted-desc",
  oneOf(TRASH_SORTS),
);

/**
 * `items`, the latest deleted first as the core lists them, in the order
 * of `sort`. By when they were deleted, the latest or the earliest first.
 * By name as the list shows it (a note without its `.md`), A to Z or Z to
 * A. By the folder each was in, A to Z or Z to A, the vault root first
 * A to Z, and the items of one folder A to Z. Those alike otherwise keep
 * the latest deleted first.
 */
export function sortTrash(
  items: readonly TrashItem[],
  sort: TrashSort,
): readonly TrashItem[] {
  if (sort === "deleted-desc") return items;
  if (sort === "deleted-asc") return [...items].reverse();
  const names = (a: TrashItem, b: TrashItem) =>
    byName.compare(entryLabel(a.path), entryLabel(b.path));
  // Sorting is stable: items alike stay the latest deleted first.
  if (sort === "name-asc") return [...items].sort(names);
  if (sort === "name-desc") return [...items].sort((a, b) => names(b, a));
  const places = (a: TrashItem, b: TrashItem) =>
    byName.compare(parentOf(a.path), parentOf(b.path));
  return [...items].sort(
    (a, b) =>
      (sort === "place-asc" ? places(a, b) : places(b, a)) || names(a, b),
  );
}
