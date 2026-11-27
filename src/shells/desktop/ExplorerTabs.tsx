import type { ReactNode } from "react";
import { useT } from "../../features/i18n/i18n";
import type { MessageKey } from "../../features/i18n/i18n";
import { Tooltip } from "../../features/ui/Tooltip";
import { toolbarIcons } from "./toolbar-icons";
import { EXPLORER_VIEWS, type ExplorerView } from "./use-sidebar-view";

const TABS: Record<ExplorerView, { label: MessageKey; icon: ReactNode }> = {
  files: { label: "shell.files", icon: toolbarIcons.fileTree },
  bookmarks: { label: "shell.bookmarks", icon: toolbarIcons.bookmarks },
  drafts: { label: "shell.drafts", icon: toolbarIcons.drafts },
  trash: { label: "shell.trash", icon: toolbarIcons.trash },
};

/**
 * The row of tabs at the top of the file explorer: the files, the
 * bookmarks, the drafts and the trash, one shown at a time below it. Drawn
 * as the buttons of the toolbar, side by side, and as tall as the bar
 * above a note, so their lines meet.
 */
export function ExplorerTabs({
  current,
  onShow,
  end,
}: {
  current: ExplorerView;
  onShow: (view: ExplorerView) => void;
  /** At the right end of the row: buttons for the tab shown, as sorting. */
  end?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-line px-1.5">
      {EXPLORER_VIEWS.map((view) => {
        const label = t(TABS[view].label);
        const shown = view === current;
        return (
          <Tooltip key={view} label={label}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={shown}
              className={`flex size-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors duration-100 hover:bg-selected hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong ${
                shown ? "bg-selected text-fg" : "text-muted"
              }`}
              onClick={() => onShow(view)}
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
                {TABS[view].icon}
              </svg>
            </button>
          </Tooltip>
        );
      })}
      {end !== undefined && <div className="ml-auto flex">{end}</div>}
    </div>
  );
}
