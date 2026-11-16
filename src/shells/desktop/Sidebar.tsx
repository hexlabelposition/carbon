import { useState, type ReactNode } from "react";
import { useT } from "../../features/i18n/i18n";
import { ResizeHandle } from "./ResizeHandle";
import { SlidePanel } from "./SlidePanel";

interface SidebarProps {
  /** Shown, or slid shut to the left edge. */
  open: boolean;
  /** Width as a share of the window width. */
  fraction: number;
  onResize: (fraction: number) => void;
  onNudge: (steps: number) => void;
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
        className="relative flex h-full flex-col bg-panel"
      >
        {/* The window has no system title bar: this empty row drags it. It
            runs on into the top row beside it, with no line between. */}
        <div
          data-tauri-drag-region
          className="h-12 shrink-0 border-b border-line"
        />
        <div className="min-h-0 flex-1 overflow-auto border-r border-line">
          {children}
        </div>
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
