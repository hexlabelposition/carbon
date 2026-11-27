import { Menu } from "@base-ui/react/menu";
import type { ReactNode } from "react";
import { useT, type MessageKey } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { treeToolButton } from "./tree-tool-button";
import { TREE_SORTS, treeSortPreference, type TreeSort } from "./tree-sort";

const labels: Record<TreeSort, MessageKey> = {
  "name-asc": "tree.sortNameAsc",
  "name-desc": "tree.sortNameDesc",
  "created-desc": "tree.sortCreatedDesc",
  "created-asc": "tree.sortCreatedAsc",
  "modified-desc": "tree.sortModifiedDesc",
  "modified-asc": "tree.sortModifiedAsc",
};

/**
 * The icon of each order, drawn on 16 by 16: an arrow at the left, up for
 * the first order of a pair (A to Z, the newest first) and down for the
 * other; at the right what is sorted by: lines for the name, a spark for
 * the time a file was made, a pencil for the time it changed.
 */
const ARROW_UP = "M4.5 13.5v-11M2 5l2.5-2.5L7 5";
const ARROW_DOWN = "M4.5 2.5v11M2 11l2.5 2.5L7 11";
const BY: Record<"name" | "created" | "modified", ReactNode> = {
  name: <path d="M9.5 4h5M9.5 8h3.75M9.5 12h2.5" />,
  // A spark, four points: something new.
  created: (
    <path d="M12 4.5c.3 2 1.2 3.2 3 3.5-1.8.3-2.7 1.5-3 3.5-.3-2-1.2-3.2-3-3.5 1.8-.3 2.7-1.5 3-3.5z" />
  ),
  modified: <path d="M13.25 3.5l1.5 1.5-5 5-2.25.5.5-2.25z" />,
};

function SortIcon({ sort, className }: { sort: TreeSort; className: string }) {
  const [by, way] = sort.split("-") as [keyof typeof BY, "asc" | "desc"];
  // The first of each pair: A to Z, or the newest first.
  const first = by === "name" ? way === "asc" : way === "desc";
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={first ? ARROW_UP : ARROW_DOWN} />
      {BY[by]}
    </svg>
  );
}

const item =
  "flex h-7 cursor-default items-center gap-2 rounded-sm px-2 whitespace-nowrap outline-none select-none data-highlighted:bg-raise";

/**
 * The sort button of the file explorer, with the icon of the order the
 * tree is in (`SortIcon`), and a menu of the orders of the file tree (`treeSortPreference`): by name,
 * by the time a file was made, by the time it was last changed, each
 * either way, the pairs apart by lines. Folders are always above files.
 */
export function TreeSortMenu() {
  const t = useT();
  const sort = treeSortPreference.use();
  return (
    <Menu.Root>
      <Tooltip label={t("tree.sort")}>
        <Menu.Trigger
          aria-label={`${t("tree.sort")}: ${t(labels[sort])}`}
          className={`${treeToolButton} data-popup-open:bg-selected data-popup-open:text-fg`}
        >
          <SortIcon sort={sort} className="size-4.5" />
        </Menu.Trigger>
      </Tooltip>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 outline-none"
        >
          <Menu.Popup
            // Not back to the button: closed by Escape, base-ui would draw
            // its focus ring on it.
            finalFocus={false}
            className="w-max min-w-64 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none"
          >
            <Menu.RadioGroup
              value={sort}
              onValueChange={(value: TreeSort) => treeSortPreference.set(value)}
            >
              {TREE_SORTS.map((value, index) => [
                // A line before each pair but the first.
                index > 0 && index % 2 === 0 && (
                  <Menu.Separator
                    key={`line-${value}`}
                    className="mx-1 my-1 h-px bg-line"
                  />
                ),
                <Menu.RadioItem key={value} value={value} className={item}>
                  <SortIcon
                    sort={value}
                    className="size-4.5 shrink-0 text-muted"
                  />
                  <span className="flex-1">{t(labels[value])}</span>
                  {/* As wide whether checked or not, so the items line up. */}
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <Menu.RadioItemIndicator>
                      <svg
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    </Menu.RadioItemIndicator>
                  </span>
                </Menu.RadioItem>,
              ])}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
