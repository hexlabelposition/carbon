import type { ReactNode } from "react";
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
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onActivate: (id: number) => void;
  onClose: (id: number) => void;
  /** The bar is at the top right: it leaves the window buttons room. */
  leaveRoom?: boolean;
  /** The bar is at the top left: it leaves the mark of the app room. */
  leaveRoomStart?: boolean;
}

/**
 * The row of tabs above the note, with back and forward. Layout only. Its
 * empty space drags the window, which has no system title bar.
 */
export function TabBar({
  tabs,
  activeId,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
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
        className="flex shrink-0 items-center gap-0.5 px-1.5"
      >
        <ArrowButton
          label={t("tabs.back")}
          disabled={!canGoBack}
          onClick={onBack}
        >
          <path d="M10 4l-4 4 4 4" />
        </ArrowButton>
        <ArrowButton
          label={t("tabs.forward")}
          disabled={!canGoForward}
          onClick={onForward}
        >
          <path d="M6 4l4 4-4 4" />
        </ArrowButton>
      </div>
      <div
        data-tauri-drag-region
        role="tablist"
        aria-label={t("tabs.openNotes")}
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              className={`flex max-w-60 min-w-24 flex-1 items-center border-l border-line ${
                active ? "bg-bg text-fg" : "text-muted hover:bg-raise"
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
                className="h-full min-w-0 flex-1 truncate pr-1 pl-3 text-left"
                onClick={() => onActivate(tab.id)}
              >
                {tab.label}
              </button>
              <button
                type="button"
                aria-label={t("tabs.close", { name: tab.label })}
                className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded-sm text-faint hover:bg-selected hover:text-fg"
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

interface ArrowButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
  /** The `<path>` of the arrow. */
  children: ReactNode;
}

function ArrowButton({ label, disabled, onClick, children }: ArrowButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="flex size-6 items-center justify-center rounded-sm text-muted hover:bg-raise hover:text-fg disabled:text-faint disabled:opacity-50 disabled:hover:bg-transparent"
      onClick={onClick}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        {children}
      </svg>
    </button>
  );
}
