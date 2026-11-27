import { SortMenu } from "../ui/SortMenu";
import { SORT_BY, type SortOption } from "../ui/sort-option";
import { tagSortPreference, type TagSort } from "./tag-sort";

/** The orders of the tags, in pairs, as `TAG_SORTS`. */
const OPTIONS: readonly SortOption<TagSort>[] = [
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
    value: "count-desc",
    label: "tags.sortCountDesc",
    by: SORT_BY.count,
    first: true,
  },
  {
    value: "count-asc",
    label: "tags.sortCountAsc",
    by: SORT_BY.count,
    first: false,
  },
];

/**
 * The sort button of the tags (`tagSortPreference`): by name, or by the
 * number of their notes, each either way.
 */
export function TagSortMenu() {
  const sort = tagSortPreference.use();
  return (
    <SortMenu
      value={sort}
      options={OPTIONS}
      onChange={(value) => tagSortPreference.set(value)}
    />
  );
}
