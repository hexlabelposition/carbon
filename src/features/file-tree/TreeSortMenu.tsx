import { Menu } from "@base-ui/react/menu";
import { useT, type MessageKey } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { TREE_SORTS, treeSortPreference, type TreeSort } from "./tree-sort";

const labels: Record<TreeSort, MessageKey> = {
  "name-asc": "tree.sortNameAsc",
  "name-desc": "tree.sortNameDesc",
  "created-desc": "tree.sortCreatedDesc",
  "created-asc": "tree.sortCreatedAsc",
  "modified-desc": "tree.sortModifiedDesc",
  "modified-asc": "tree.sortModifiedAsc",
};

const item =
  "flex h-7 cursor-default items-center gap-2 rounded-sm px-2 whitespace-nowrap outline-none select-none data-highlighted:bg-raise";

/**
 * The sort button of the file explorer: an arrow up beside lines, and a
 * menu of the orders of the file tree (`treeSortPreference`): by name,
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
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted outline-none transition-colors duration-100 hover:bg-selected hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong data-popup-open:bg-selected data-popup-open:text-fg"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="size-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* An arrow up, and lines that grow shorter beside it. */}
            <path d="M4.5 13.5v-11M2 5l2.5-2.5L7 5M9.5 4h5M9.5 8h3.75M9.5 12h2.5" />
          </svg>
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
