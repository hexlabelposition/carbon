import { useEffect, type KeyboardEvent, type PointerEvent } from "react";
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

  // Gone in the middle of a drag, such as a panel shut by its shortcut:
  // text can be selected again.
  useEffect(() => () => selectText(true), []);

  function drag(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // From where the panel starts, which need not be the edge of the
    // window: the toolbar can stand before the left one.
    const panel = event.currentTarget.parentElement?.getBoundingClientRect();
    if (panel === undefined) return;
    const width = document.documentElement.clientWidth;
    const x =
      side === "left"
        ? event.clientX - panel.left
        : panel.right - event.clientX;
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
      // Below the top row, as the line at the edge of the panel: the row
      // runs on into the one beside it and drags the window.
      className={`absolute top-12 bottom-0 z-10 w-1.5 cursor-col-resize touch-none outline-none hover:bg-line-strong/60 focus-visible:bg-line-strong ${
        side === "left" ? "right-0" : "left-0"
      }`}
      onPointerDown={(event) => {
        // Not the start of a text selection, which the drag would stretch.
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        selectText(false);
        onDragging(true);
      }}
      onPointerMove={drag}
      onLostPointerCapture={() => {
        selectText(true);
        onDragging(false);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

/**
 * Lets text in the window be selected, or not: not while a panel edge is
 * dragged, or the pointer passing over the interface would select it.
 */
function selectText(allowed: boolean): void {
  const { style } = document.documentElement;
  style.userSelect = allowed ? "" : "none";
  style.webkitUserSelect = allowed ? "" : "none";
}
