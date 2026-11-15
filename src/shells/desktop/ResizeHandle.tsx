import type { KeyboardEvent, PointerEvent } from "react";
import { SIDEBAR_MAX, SIDEBAR_MIN } from "./use-sidebar";

interface ResizeHandleProps {
  /** The edge of the window the panel stands at. */
  side: "left" | "right";
  /** Names it for screen readers, such as "Resize sidebar". */
  label: string;
  /** Width of the panel as a share of the window width. */
  fraction: number;
  onResize: (fraction: number) => void;
  onNudge: (steps: number) => void;
  /** Told when a drag starts and ends: the panel stops gliding meanwhile. */
  onDragging: (dragging: boolean) => void;
}

/**
 * The edge of a side panel that resizes it: dragged, or with the arrow
 * keys once focused. It sits on the inner edge, inside the panel, which
 * cuts what reaches past it as it slides.
 */
export function ResizeHandle({
  side,
  label,
  fraction,
  onResize,
  onNudge,
  onDragging,
}: ResizeHandleProps) {
  const percent = (value: number) => Math.round(value * 100);

  function drag(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // The panel starts at its edge of the window.
    const width = document.documentElement.clientWidth;
    const x = side === "left" ? event.clientX : width - event.clientX;
    onResize(x / width);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The arrow that points away from the edge makes the panel wider.
    const wider = side === "left" ? "ArrowRight" : "ArrowLeft";
    const narrower = side === "left" ? "ArrowLeft" : "ArrowRight";
    if (event.key === wider) onNudge(1);
    else if (event.key === narrower) onNudge(-1);
    else return;
    event.preventDefault();
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={percent(fraction)}
      aria-valuemin={percent(SIDEBAR_MIN)}
      aria-valuemax={percent(SIDEBAR_MAX)}
      tabIndex={0}
      className={`absolute inset-y-0 z-10 w-1.5 cursor-col-resize touch-none outline-none hover:bg-line-strong/60 focus-visible:bg-line-strong ${
        side === "left" ? "right-0" : "left-0"
      }`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onDragging(true);
      }}
      onPointerMove={drag}
      onLostPointerCapture={() => onDragging(false)}
      onKeyDown={onKeyDown}
    />
  );
}
