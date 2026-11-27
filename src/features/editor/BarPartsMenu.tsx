import { ContextMenu } from "@base-ui/react/context-menu";
import { useT, type MessageKey } from "../i18n/i18n";
import type { Preference } from "../settings/preference";
import { MenuItemBody } from "../ui/MenuItemBody";
import type { MenuIcon } from "../ui/menu-icons";
import { setPartShown } from "./bar-parts";

/**
 * The menu of the right button on a bar of a note: a switch for each of
 * its `parts`, with its icon, that shows or hides it (`hidden`).
 */
export function BarPartsMenu<P extends string>({
  parts,
  items,
  hidden,
}: {
  parts: readonly P[];
  items: Record<P, { label: MessageKey; icon: MenuIcon }>;
  hidden: Preference<readonly P[]>;
}) {
  const t = useT();
  const off = hidden.use();
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner className="z-50 outline-none">
        <ContextMenu.Popup className="min-w-56 rounded-md border border-line bg-bg p-1 text-ui text-fg shadow-dialog outline-none">
          {parts.map((part) => (
            <ContextMenu.CheckboxItem
              key={part}
              className="flex h-7 cursor-default items-center gap-2 rounded-sm px-2 outline-none select-none data-highlighted:bg-raise"
              checked={!off.includes(part)}
              onCheckedChange={(shown) => setPartShown(hidden, part, shown)}
            >
              <MenuItemBody icon={items[part].icon}>
                {t(items[part].label)}
              </MenuItemBody>
              <span className="flex size-4 shrink-0 items-center justify-center">
                <ContextMenu.CheckboxItemIndicator>
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
                </ContextMenu.CheckboxItemIndicator>
              </span>
            </ContextMenu.CheckboxItem>
          ))}
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
