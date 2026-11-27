import type { ReactNode } from "react";
import { Shortcut } from "../commands/Shortcut";
import { menuIcons, type MenuIcon } from "./menu-icons";

/**
 * What a menu item shows: its icon, its text, and at the right its keys,
 * if it has any. The icon takes the colour of the text, so it is faint
 * when the item is off and red for a delete.
 */
export function MenuItemBody({
  icon,
  keys,
  children,
}: {
  icon: MenuIcon;
  /** The shortcut, as "Ctrl+C". */
  keys?: string;
  children: ReactNode;
}) {
  return (
    <>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-4 shrink-0 opacity-80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {menuIcons[icon]}
      </svg>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {keys !== undefined && (
        <span className="ml-4">
          <Shortcut text={keys} />
        </span>
      )}
    </>
  );
}
