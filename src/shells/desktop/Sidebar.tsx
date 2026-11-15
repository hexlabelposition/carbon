import { useState, type ReactNode } from "react";
import { useT } from "../../features/i18n/i18n";
import { APP_MARK_ROOM } from "./AppMark";
import { ResizeHandle } from "./ResizeHandle";
import { SlidePanel } from "./SlidePanel";

interface SidebarProps {
  /** Shown, or slid shut to the left edge. */
  open: boolean;
  /** Width as a share of the window width. */
  fraction: number;
  onResize: (fraction: number) => void;
  onNudge: (steps: number) => void;
  /** The fixed top row: what the sidebar belongs to and its actions. */
  header: ReactNode;
  children: ReactNode;
}

/**
 * The left panel of the desktop layout with its resize handle. Layout only:
 * what is shown inside, whether it is open and how wide it is come from
 * outside. It slides open and shut.
 */
export function Sidebar({
  open,
  fraction,
  onResize,
  onNudge,
  header,
  children,
}: SidebarProps) {
  const t = useT();
  /** The handle is being dragged: the width follows it without gliding. */
  const [resizing, setResizing] = useState(false);

  return (
    // A share of the window, which the panel starts at the left edge of:
    // `vw`. Never narrower than 180 pixels.
    <SlidePanel
      open={open}
      width={`max(11.25rem, ${fraction * 100}vw)`}
      animate={!resizing}
    >
      <aside
        aria-label={t("shell.leftPanel")}
        className="relative flex h-full flex-col border-r border-line bg-panel"
      >
        {/* The window has no system title bar: this row drags it. */}
        <div
          data-tauri-drag-region
          className={`flex h-12 shrink-0 items-center gap-2 border-b border-line pr-3 ${APP_MARK_ROOM}`}
        >
          {header}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        <ResizeHandle
          side="left"
          label={t("shell.resizeLeftPanel")}
          fraction={fraction}
          onResize={onResize}
          onNudge={onNudge}
          onDragging={setResizing}
        />
      </aside>
    </SlidePanel>
  );
}
