import { useEffect, useState, type ReactNode } from "react";

/** How long it takes to slide, in milliseconds: `duration-200` below. */
const SLIDE = 200;

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
  // Whether the content is there: while open, and while sliding shut.
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  useEffect(() => {
    if (open || keepMounted) return;
    const timer = setTimeout(() => setShown(false), SLIDE);
    return () => clearTimeout(timer);
  }, [open, keepMounted]);

  return (
    <div
      inert={!open}
      className={`flex h-full shrink-0 overflow-hidden ${
        side === "left" ? "justify-end" : "justify-start"
      } ${
        animate
          ? "transition-[width] duration-200 ease-out motion-reduce:transition-none"
          : ""
      }`}
      style={{ width: open ? width : 0 }}
    >
      <div className="h-full shrink-0" style={{ width }}>
        {(keepMounted || shown) && children}
      </div>
    </div>
  );
}
