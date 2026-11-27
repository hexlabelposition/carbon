import { SortMenu } from "../ui/SortMenu";
import { SORT_BY, type SortOption } from "../ui/sort-option";
import { bookmarkSortPreference, type BookmarkSort } from "./bookmark-sort";

/** The orders of the bookmarks, in pairs, as `BOOKMARK_SORTS`. */
const OPTIONS: readonly SortOption<BookmarkSort>[] = [
  {
    value: "added-desc",
    label: "bookmarks.sortAddedDesc",
    by: SORT_BY.added,
    first: true,
  },
  {
    value: "added-asc",
    label: "bookmarks.sortAddedAsc",
    by: SORT_BY.added,
    first: false,
  },
  {
    value: "name-asc",
    label: "tree.sortNameAsc",
    by: SORT_BY.name,
    first: true,
  },
  {
    value: "name-desc",
    label: "tree.sortNameDesc",
    by: SORT_BY.name,
    first: false,
  },
  {
    value: "modified-desc",
    label: "tree.sortModifiedDesc",
    by: SORT_BY.modified,
    first: true,
  },
  {
    value: "modified-asc",
    label: "tree.sortModifiedAsc",
    by: SORT_BY.modified,
    first: false,
  },
];

/**
 * The sort button of the bookmarks (`bookmarkSortPreference`): by when
 * they were added, by name, by when the file last changed, each either
 * way.
 */
export function BookmarkSortMenu() {
  const sort = bookmarkSortPreference.use();
  return (
    <SortMenu
      value={sort}
      options={OPTIONS}
      onChange={(value) => bookmarkSortPreference.set(value)}
    />
  );
}
