import type { ReactNode } from "react";

/** A group of buttons in the row, with the line at its right. */
const group = "flex items-center gap-0.5 border-r border-line px-1.5";

/**
 * A row of groups of buttons at the top of a view of the sidebar, as tall
 * as the bar above a note, so their lines meet. Each group is closed by a
 * line at its right that runs the height of the row: two groups side by
 * side share one line.
 */
export function SidebarToolRow({ groups }: { groups: readonly ReactNode[] }) {
  return (
    <div className="flex h-11 shrink-0 border-b border-line">
      {groups.map((items, index) => (
        // The groups of a view are always the same ones, in the same order.
        <div key={index} className={group}>
          {items}
        </div>
      ))}
    </div>
  );
}
