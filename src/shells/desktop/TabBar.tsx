import { useT } from "../../features/i18n/i18n";
import { APP_MARK_ROOM } from "./AppMark";
import { WINDOW_CONTROLS_ROOM } from "./WindowControls";

export interface TabBarTab {
  id: number;
  /** What the tab is called. */
  label: string;
  /** Shown on hover: the full path of the note. */
  title: string;
}

interface TabBarProps {
  tabs: readonly TabBarTab[];
  activeId: number | null;
  onActivate: (id: number) => void;
  onClose: (id: number) => void;
  /** The bar is at the top right: it leaves the window buttons room. */
  leaveRoom?: boolean;
  /** The bar is at the top left: it leaves the mark of the app room. */
  leaveRoomStart?: boolean;
}

/**
 * The row of tabs above the note. Layout only. Its empty space drags the
 * window, which has no system title bar. Each tab is a rounded button as
 * wide as its name, a little apart from the next.
 */
export function TabBar({
  tabs,
  activeId,
  onActivate,
  onClose,
  leaveRoom = false,
  leaveRoomStart = false,
}: TabBarProps) {
  const t = useT();
  return (
    <div
      data-tauri-drag-region
      className={`flex h-12 shrink-0 items-stretch border-b border-line bg-panel ${
        leaveRoom ? WINDOW_CONTROLS_ROOM : ""
      } ${leaveRoomStart ? APP_MARK_ROOM : ""}`}
    >
      <div
        data-tauri-drag-region
        role="tablist"
        aria-label={t("tabs.openNotes")}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1.5"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              // A rounded button of its own, as wide as its name, filled and
              // edged so it stands out from the bar. The one shown is in
              // the color of the note below it, with a stronger edge.
              className={`flex h-7 max-w-52 min-w-20 shrink-0 items-center rounded-md border transition-colors duration-100 ${
                active
                  ? "border-line-strong bg-bg text-fg shadow-xs"
                  : "border-line bg-raise text-muted hover:bg-selected hover:text-fg"
              }`}
              // The middle button closes a tab, as in a browser.
              onAuxClick={(event) => {
                if (event.button === 1) onClose(tab.id);
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                title={tab.title}
                className="h-full min-w-0 flex-1 truncate rounded-md pr-1 pl-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-line-strong"
                onClick={() => onActivate(tab.id)}
              >
                {tab.label}
              </button>
              <button
                type="button"
                aria-label={t("tabs.close", { name: tab.label })}
                className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-sm text-faint hover:bg-line-strong/50 hover:text-fg"
                onClick={() => onClose(tab.id)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
