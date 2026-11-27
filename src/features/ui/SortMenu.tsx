import { Menu } from "@base-ui/react/menu";
import { useT } from "../i18n/i18n";
import type { SortOption } from "./sort-option";
import { Tooltip } from "./Tooltip";
import { toolButton } from "./tool-button";

const ARROW_UP = "M4.5 13.5v-11M2 5l2.5-2.5L7 5";
const ARROW_DOWN = "M4.5 2.5v11M2 11l2.5 2.5L7 11";

/** An arrow at the left, up for the first order of a pair, and the key. */
function SortIcon<T extends string>({
  option,
  className,
}: {
  option: SortOption<T>;
  className: string;
}) {
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
      <path d={option.first ? ARROW_UP : ARROW_DOWN} />
      {option.by}
    </svg>
  );
}

const item =
  "flex h-7 cursor-default items-center gap-2 rounded-sm px-2 whitespace-nowrap outline-none select-none data-highlighted:bg-raise";

/**
 * A sort button for the row at the top of a view of the sidebar, with the
 * icon of the order picked (`value`), and a menu of the `options`: in
 * pairs, the two ways of one key, the pairs apart by lines.
 */
export function SortMenu<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly SortOption<T>[];
  onChange: (value: T) => void;
}) {
  const t = useT();
  const current = options.find((option) => option.value === value);
  if (current === undefined) return null;
  return (
    <Menu.Root>
      <Tooltip label={t("tree.sort")}>
        <Menu.Trigger
          aria-label={`${t("tree.sort")}: ${t(current.label)}`}
          className={`${toolButton} data-popup-open:bg-selected data-popup-open:text-fg`}
        >
          <SortIcon option={current} className="size-4.5" />
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
              value={value}
              onValueChange={(next: T) => onChange(next)}
            >
              {options.map((option, index) => [
                // A line before each pair but the first.
                index > 0 && index % 2 === 0 && (
                  <Menu.Separator
                    key={`line-${option.value}`}
                    className="mx-1 my-1 h-px bg-line"
                  />
                ),
                <Menu.RadioItem
                  key={option.value}
                  value={option.value}
                  className={item}
                >
                  <SortIcon
                    option={option}
                    className="size-4.5 shrink-0 text-muted"
                  />
                  <span className="flex-1">{t(option.label)}</span>
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
