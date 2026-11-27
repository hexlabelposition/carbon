import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { panelCloseFraction, panelSnapFraction } from "./layout";
import { startLayoutMotion } from "./layout-motion";
import { SIDEBAR_STEP } from "./use-sidebar";

interface ResizeHandleProps {
  /** The edge of the window the panel stands at. */
  side: "left" | "right";
  /** Names it for screen readers, such as "Resize sidebar". */
  label: string;
  /** Width of the panel as a share of the window width. */
  fraction: number;
  /** Its usual width, which a drag stops at when near it. */
  usual: number;
  /**
   * The widest it can be now, as a share of the window: what the other
   * panel or the toolbar leaves, with the narrowest notes beside it, so
   * the two panels never cover each other.
   */
  room: () => number;
  onResize: (fraction: number) => void;
  onNudge: (steps: number) => void;
  /** Closes the panel: dragged or nudged near the edge it stands at. */
  onClose: () => void;
  /** Told when a drag starts and ends: the panel stops gliding meanwhile. */
  onDragging: (dragging: boolean) => void;
}

/**
 * The edge of a side panel that resizes it: dragged, or with the arrow
 * keys once focused. It stands beside the panel, not in it, which would
 * cut it: it reaches as far out of the panel as into it, over the line at
 * its edge, so it is easy to catch, and only the middle of it, a thin
 * line, is lit: after a moment under the pointer, so not as it passes
 * by, and all the while it is dragged. Its parent is as wide as the
 * panel and starts where the panel does.
 *
 * The panel has no narrowest width: it follows the pointer down to the
 * edge, and a drag that ends near the edge (`panelCloseFraction`) closes
 * it, at the width it had when the drag started, so it opens again at a
 * width it can be used at. An arrow key that would make it that narrow
 * closes it too. Near its usual width it stops at that width
 * (`panelSnapFraction`), unless Alt is held, and the edge is lit
 * meanwhile, so it shows. A double click puts it back at that width.
 */
export function ResizeHandle({
  side,
  label,
  fraction,
  usual,
  room,
  onResize,
  onNudge,
  onClose,
  onDragging,
}: ResizeHandleProps) {
  const percent = (value: number) => Math.round(value * 100);

  // Gone in the middle of a drag, such as a panel shut by its shortcut:
  // text can be selected again.
  // The note beside the panel changes width as it follows the pointer.
  const endMotion = useRef<(() => void) | null>(null);
  /** The width as the drag started, and the last one it set. */
  const dragWidths = useRef<{ start: number; last: number } | null>(null);
  /** Lit all the while it is dragged, even with the pointer off it. */
  const [dragging, setDragging] = useState(false);
  /** The drag holds the panel at its usual width: the edge is lit. */
  const [snapped, setSnapped] = useState(false);
  useEffect(
    () => () => {
      selectText(true);
      endMotion.current?.();
    },
    [],
  );

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
    const wanted = x / width;
    const snaps =
      !event.altKey &&
      usual <= room() &&
      Math.abs(wanted - usual) <= panelSnapFraction();
    setSnapped(snaps);
    const next = Math.max(0, Math.min(room(), snaps ? usual : wanted));
    if (dragWidths.current !== null) dragWidths.current.last = next;
    onResize(next);
  }

  /** A drag ended: near the edge, the panel closes at its earlier width. */
  function endDrag() {
    const widths = dragWidths.current;
    dragWidths.current = null;
    if (widths === null || widths.last >= panelCloseFraction()) return;
    onResize(widths.start);
    onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The arrow that points away from the edge makes the panel wider.
    const wider = side === "left" ? "ArrowRight" : "ArrowLeft";
    const narrower = side === "left" ? "ArrowLeft" : "ArrowRight";
    if (event.key === wider) {
      if (fraction + SIDEBAR_STEP > room()) onResize(room());
      else onNudge(1);
    } else if (event.key === narrower) {
      if (fraction - SIDEBAR_STEP < panelCloseFraction()) onClose();
      else onNudge(-1);
    } else return;
    event.preventDefault();
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={percent(fraction)}
      aria-valuemin={0}
      aria-valuemax={percent(room())}
      tabIndex={0}
      data-dragging={dragging || undefined}
      data-snapped={snapped || undefined}
      // The right panel has a top row of its own, which runs on into the
      // one beside it and drags the window: the handle starts below it, as
      // the line at its edge. The left panel stands below the top row.
      className={`group absolute bottom-0 z-10 flex w-2.5 cursor-col-resize touch-none justify-center outline-none ${
        side === "left" ? "top-0 -right-1.25" : "top-bar -left-1.25"
      }`}
      onPointerDown={(event) => {
        // Not the start of a text selection, which the drag would stretch.
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        selectText(false);
        endMotion.current?.();
        endMotion.current = startLayoutMotion();
        dragWidths.current = { start: fraction, last: fraction };
        setDragging(true);
        onDragging(true);
      }}
      onPointerMove={drag}
      onLostPointerCapture={() => {
        selectText(true);
        endMotion.current?.();
        endMotion.current = null;
        setDragging(false);
        onDragging(false);
        setSnapped(false);
        endDrag();
      }}
      onDoubleClick={() => onResize(Math.min(usual, room()))}
      onKeyDown={onKeyDown}
    >
      {/*
        The line that is lit, over the one at the edge of the panel. Lit on
        hover after a moment, dark again at once.
      */}
      <div className="h-full w-0.5 transition-colors delay-0 duration-100 group-hover:bg-line-strong group-hover:delay-150 group-focus-visible:bg-line-strong group-data-dragging:bg-line-strong group-data-dragging:delay-0 group-data-snapped:bg-link motion-reduce:transition-none" />
    </div>
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
