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
    <SlidePanel open={open} width={sidebarWidth(fraction)} animate={!resizing}>
      <aside
        aria-label={t("shell.leftPanel")}
        className="relative flex h-full flex-col border-r border-line bg-panel"
      >
        {/* Below the top row, which the tabs run along. */}
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

/**
 * How wide the sidebar is open, as a CSS length: a share of the window,
 * which it starts near the left edge of (`vw`), never narrower than 180
 * pixels.
 */
export function sidebarWidth(fraction: number): string {
  return `max(11.25rem, ${fraction * 100}vw)`;
}
