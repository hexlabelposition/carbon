import { useCallback } from "react";

/** How much of the way left the scroll goes each frame: higher is snappier. */
const EASE = 0.18;

/**
 * Makes a mouse wheel glide a scrolling element instead of jumping a few
 * lines a notch: the WebView animates a notch only briefly. A touchpad is
 * left alone, it scrolls smoothly by itself, and so are Ctrl and Shift
 * with the wheel, which zoom and scroll sideways.
 *
 * Returns a ref for the element: it works from when the element appears.
 */
export function useSmoothWheel(): (element: HTMLElement | null) => void {
  return useCallback((element: HTMLElement | null) => {
    if (element === null) return;

    /** Where the scroll is going; `null` while it is not gliding. */
    let target: number | null = null;
    /** Where this hook last put the scroll, to notice others moving it. */
    let placed = 0;
    let frame = 0;

    const glide = () => {
      if (target === null) return;
      // Something else moved the scroll, such as the scroll bar: stop.
      if (Math.abs(element.scrollTop - placed) > 1) {
        target = null;
        return;
      }
      const left = target - element.scrollTop;
      // At least a pixel a frame: the scroll may be kept in whole pixels,
      // and a smaller step would never arrive.
      const size = Math.min(Math.max(Math.abs(left) * EASE, 1), Math.abs(left));
      const wanted = element.scrollTop + Math.sign(left) * size;
      // "instant": the CSS `scroll-behavior: smooth` of the scroller would
      // animate every step on its own.
      element.scrollTo({ top: wanted, behavior: "instant" });
      placed = element.scrollTop;
      // Arrived, or stopped at an end short of the target.
      if (Math.abs(target - placed) < 1 || Math.abs(placed - wanted) >= 1) {
        target = null;
        return;
      }
      frame = requestAnimationFrame(glide);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || !isMouseWheel(event)) return;
      event.preventDefault();
      const max = element.scrollHeight - element.clientHeight;
      const from = target ?? element.scrollTop;
      target = Math.min(Math.max(from + pixelsOf(event), 0), max);
      placed = element.scrollTop;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(glide);
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(frame);
    };
  }, []);
}

/**
 * A notch of a mouse wheel: counted in lines, or in whole steps of 120 as
 * browsers report a notch. A touchpad sends small, uneven pixel steps.
 */
function isMouseWheel(event: WheelEvent): boolean {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return true;
  const notch = (event as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
  return notch !== undefined && notch !== 0 && notch % 120 === 0;
}

/** How far the event asks to scroll down, in pixels. */
function pixelsOf(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 40;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * (event.currentTarget as HTMLElement).clientHeight;
  }
  return event.deltaY;
}
