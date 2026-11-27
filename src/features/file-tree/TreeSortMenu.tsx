import { SortMenu } from "../ui/SortMenu";
import { SORT_BY, type SortOption } from "../ui/sort-option";
import { treeSortPreference, type TreeSort } from "./tree-sort";

/** The orders of the file tree, in pairs, as `TREE_SORTS`. */
const OPTIONS: readonly SortOption<TreeSort>[] = [
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
    value: "created-desc",
    label: "tree.sortCreatedDesc",
    by: SORT_BY.created,
    first: true,
  },
  {
    value: "created-asc",
    label: "tree.sortCreatedAsc",
    by: SORT_BY.created,
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
 * The sort button of the file tree and of the drafts
 * (`treeSortPreference`): by name, by the time a file was made, by the
 * time it was last changed, each either way. Folders are always above
 * files.
 */
export function TreeSortMenu() {
  const sort = treeSortPreference.use();
  return (
    <SortMenu
      value={sort}
      options={OPTIONS}
      onChange={(value) => treeSortPreference.set(value)}
    />
  );
}
