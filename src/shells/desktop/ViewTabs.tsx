import type { ReactNode } from "react";
import { Tooltip } from "../../features/ui/Tooltip";

interface ViewTabsProps<View extends string> {
  /** Names the row for screen readers, such as "Right panel views". */
  label: string;
  views: readonly {
    view: View;
    label: string;
    /** The shapes of its icon, on 16 by 16. */
    icon: ReactNode;
    /** A number beside the icon, such as how many backlinks there are. */
    count?: number | null;
  }[];
  current: View;
  onShow: (view: View) => void;
}

/**
 * The row of tabs at the top of the right panel that picks what it shows:
 * icons with their names in tooltips, drawn as the tabs of the file
 * explorer (`ExplorerTabs`), and as tall as the bar above a note, so their
 * lines meet.
 */
export function ViewTabs<View extends string>({
  label,
  views,
  current,
  onShow,
}: ViewTabsProps<View>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex h-11 shrink-0 items-center gap-0.5 border-b border-line px-1.5"
    >
      {views.map(({ view, label: name, icon, count }) => {
        const shown = current === view;
        const counted = count !== undefined && count !== null;
        return (
          <Tooltip key={view} label={name}>
            <button
              type="button"
              role="tab"
              aria-selected={shown}
              aria-label={counted ? `${name}, ${count}` : name}
              className={`flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md outline-none transition-colors duration-100 hover:bg-selected hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong ${
                counted ? "px-2" : ""
              } ${shown ? "bg-selected text-fg" : "text-muted"}`}
              onClick={() => onShow(view)}
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="size-4.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icon}
              </svg>
              {counted && (
                <span aria-hidden="true" className="text-small text-faint">
                  {count}
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
