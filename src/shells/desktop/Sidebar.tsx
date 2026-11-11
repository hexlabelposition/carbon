import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { SIDEBAR_MAX, SIDEBAR_MIN } from "./use-sidebar";

interface SidebarProps {
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
 * what is shown inside and how wide it is come from outside.
 */
export function Sidebar({
  fraction,
  onResize,
  onNudge,
  header,
  children,
}: SidebarProps) {
  const percent = (value: number) => Math.round(value * 100);

  function drag(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // The sidebar starts at the left edge of the window.
    onResize(event.clientX / document.documentElement.clientWidth);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") onNudge(-1);
    else if (event.key === "ArrowRight") onNudge(1);
    else return;
    event.preventDefault();
  }

  return (
    <aside
      aria-label="Sidebar"
      className="relative flex min-w-45 shrink-0 flex-col border-r border-line bg-panel"
      style={{ width: `${fraction * 100}%` }}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={percent(fraction)}
        aria-valuemin={percent(SIDEBAR_MIN)}
        aria-valuemax={percent(SIDEBAR_MAX)}
        tabIndex={0}
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none hover:bg-line-strong/60 focus-visible:bg-line-strong"
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={drag}
        onKeyDown={onKeyDown}
      />
    </aside>
  );
}
