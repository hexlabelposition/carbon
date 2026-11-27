import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { startLayoutMotion } from "./layout-motion";
import { SLIDE_CLOSE_MS, setSlideDirection } from "./slide-motion";

interface SlidePanelProps {
  open: boolean;
  /**
   * The side of the window it stands at. The panel slides out past that
   * side: its inner edge, with the line drawn along it, stays in sight
   * and moves, instead of being cut off first.
   */
  side?: "left" | "right";
  /** How wide it is open, as a CSS length. */
  width: string;
  /**
   * Whether a change of width glides. Off while the width follows the
   * pointer, so the panel does not lag behind it.
   */
  animate?: boolean;
  /**
   * Keeps what is inside mounted while shut, with its scroll and state.
   * Off for content that costs work while it is not seen: it goes once
   * the panel has slid shut.
   */
  keepMounted?: boolean;
  children: ReactNode;
}

/**
 * A panel at a side of the layout that slides open and shut: its width
 * glides between nothing and `width`. What is inside keeps that width all
 * the while, so its text does not wrap anew as the panel moves, and it is
 * held at the inner edge: the panel moves out past the side of the window,
 * the outer edge cuts it. Shut, it can be neither seen nor reached.
 */
export function SlidePanel({
  open,
  side = "left",
  width,
  animate = true,
  keepMounted = true,
  children,
}: SlidePanelProps) {
  // No gliding until the layout has settled: on mount the width can still
  // change, as when the buttons in the top right corner are measured
  // anew (`--cb-controls-room`) once a vault opens, and a panel open at
  // the last start would slide half way out by itself.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setSettled(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // The way it goes sets the time and the curve of the columns of a split
  // view beside it (`data-slide`); the panel itself takes them by `open`.
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSlideDirection(open);
  }, [open]);

  // Whether the content is there: while open, and while sliding shut.
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  useEffect(() => {
    if (open || keepMounted) return;
    const timer = setTimeout(() => setShown(false), SLIDE_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, keepMounted]);

  // While it glides, the note beside it changes width (`startLayoutMotion`).
  // Native listeners: React does not pass `transitionrun` on in WebKitGTK.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = panel.current;
    if (element === null) return;
    let end: (() => void) | null = null;
    const ownWidth = (event: TransitionEvent) =>
      event.target === element && event.propertyName === "width";
    const run = (event: TransitionEvent) => {
      if (ownWidth(event)) end ??= startLayoutMotion();
    };
    const stop = (event: TransitionEvent) => {
      if (!ownWidth(event)) return;
      end?.();
      end = null;
    };
    element.addEventListener("transitionrun", run);
    element.addEventListener("transitionend", stop);
    element.addEventListener("transitioncancel", stop);
    return () => {
      element.removeEventListener("transitionrun", run);
      element.removeEventListener("transitionend", stop);
      element.removeEventListener("transitioncancel", stop);
      end?.();
    };
  }, []);

  /** How a change of width glides, for the panel and what is inside. */
  const glide =
    animate && settled
      ? `transition-[width] motion-reduce:transition-none ${
          open
            ? "duration-(--cb-slide-open-duration) ease-(--cb-slide-open-ease)"
            : "duration-(--cb-slide-close-duration) ease-(--cb-slide-close-ease)"
        }`
      : "";

  return (
    <div
      ref={panel}
      inert={!open}
      className={`flex h-full shrink-0 overflow-hidden ${
        side === "left" ? "justify-end" : "justify-start"
      } ${glide}`}
      style={{ width: open ? width : 0 }}
    >
      {/*
        Glides along with the panel when the width changes, as when it is
        put back at its usual width: at the new width at once, it would
        stand out past the panel, or leave a gap, at the outer side until
        the panel caught up. Opening and shutting leave its width alone.
      */}
      <div className={`h-full shrink-0 ${glide}`} style={{ width }}>
        {(keepMounted || shown) && children}
      </div>
    </div>
  );
}
