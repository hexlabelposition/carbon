import type { ReactNode } from "react";

interface ViewTabsProps<View extends string> {
  /** Names the row for screen readers, such as "Sidebar views". */
  label: string;
  views: readonly { view: View; label: ReactNode }[];
  current: View;
  onShow: (view: View) => void;
}

/**
 * The row of tabs at the top of a side panel that picks what it shows,
 * such as files or search. The same in both panels.
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
      className="flex shrink-0 gap-0.5 border-b border-line px-1.5 py-1"
    >
      {views.map(({ view, label: name }) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={current === view}
          className={`flex h-6 items-center gap-1.5 rounded-sm px-2 text-small hover:bg-raise hover:text-fg ${
            current === view ? "bg-selected text-fg" : "text-muted"
          }`}
          onClick={() => onShow(view)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
