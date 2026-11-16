import { ScrollArea as Base } from "@base-ui/react/scroll-area";
import type { ReactNode } from "react";

interface ScrollAreaProps {
  /** Classes of the element that scrolls, such as its greatest height. */
  className?: string;
  children: ReactNode;
}

/**
 * Room at the right of the content for the scrollbar, while there is
 * something to scroll: put it on the content, inside a `ScrollArea`.
 * The bar is drawn over the content, which would otherwise run under
 * it, rows lit up when hovered included.
 */
export const SCROLLBAR_ROOM = "group-data-has-overflow-y/scroll:pr-3";

/**
 * A scrolling area with a scrollbar of our own (ADR-024): thin, in the
 * colors of the theme, shown while the pointer is over the area or it
 * scrolls. The scrollbar of the system is hidden; in WebKitGTK it is
 * drawn over the content and grows when the pointer comes near it.
 * Scrolls by the wheel, the keys and the thumb, as any other element.
 */
export function ScrollArea({ className = "", children }: ScrollAreaProps) {
  return (
    <Base.Root className="group/scroll relative flex min-h-0 flex-col">
      <Base.Viewport
        className={`min-h-0 overscroll-contain outline-none ${className}`}
      >
        {children}
      </Base.Viewport>
      <Base.Scrollbar
        orientation="vertical"
        className="flex w-3 justify-center p-0.5 opacity-0 transition-opacity delay-300 duration-150 data-hovering:opacity-100 data-hovering:delay-0 data-scrolling:opacity-100 data-scrolling:delay-0 motion-reduce:transition-none"
      >
        <Base.Thumb className="w-full rounded-full bg-line-strong hover:bg-faint" />
      </Base.Scrollbar>
    </Base.Root>
  );
}
