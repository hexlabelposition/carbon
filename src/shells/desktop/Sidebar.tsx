import { useState, type ReactNode } from "react";
import { useT } from "../../features/i18n/i18n";
import { ResizeHandle } from "./ResizeHandle";
import { SlidePanel } from "./SlidePanel";

interface SidebarProps {
  /** Shown, or slid shut to the left edge. */
  open: boolean;
  /** Width as a share of the window width. */
  fraction: number;
  /** Its usual width, which a drag stops at when near it. */
  usual: number;
  /** How wide it is open, as a CSS length (`panelWidth`). */
  width: string;
  /** The widest it can be now, beside the right panel (`ResizeHandle`). */
  room: () => number;
  onResize: (fraction: number) => void;
  onNudge: (steps: number) => void;
  /** Closes it: its edge dragged near the left edge of the window. */
  onClose: () => void;
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
  usual,
  width,
  room,
  onResize,
  onNudge,
  onClose,
  children,
}: SidebarProps) {
  const t = useT();
  /** The handle is being dragged: the width follows it without gliding. */
  const [resizing, setResizing] = useState(false);

  return (
    <SlidePanel open={open} width={width} animate={!resizing}>
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
          usual={usual}
          room={room}
          onResize={onResize}
          onNudge={onNudge}
          onClose={onClose}
          onDragging={setResizing}
        />
      </aside>
    </SlidePanel>
  );
}
