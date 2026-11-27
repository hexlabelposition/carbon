import { SortMenu } from "../ui/SortMenu";
import { SORT_BY, type SortOption } from "../ui/sort-option";
import { trashSortPreference, type TrashSort } from "./trash-sort";

/** The orders of the trash, in pairs, as `TRASH_SORTS`. */
const OPTIONS: readonly SortOption<TrashSort>[] = [
  {
    value: "deleted-desc",
    label: "trash.sortDeletedDesc",
    by: SORT_BY.deleted,
    first: true,
  },
  {
    value: "deleted-asc",
    label: "trash.sortDeletedAsc",
    by: SORT_BY.deleted,
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
    value: "place-asc",
    label: "trash.sortPlaceAsc",
    by: SORT_BY.place,
    first: true,
  },
  {
    value: "place-desc",
    label: "trash.sortPlaceDesc",
    by: SORT_BY.place,
    first: false,
  },
];

/**
 * The sort button of the trash (`trashSortPreference`): by when an item
 * was deleted, by its name, by the folder it was in, each either way.
 */
export function TrashSortMenu() {
  const sort = trashSortPreference.use();
  return (
    <SortMenu
      value={sort}
      options={OPTIONS}
      onChange={(value) => trashSortPreference.set(value)}
    />
  );
}
