import { ScrollArea as Base } from "@base-ui/react/scroll-area";
import type { ComponentProps, ReactNode } from "react";

interface ScrollAreaProps extends Omit<ComponentProps<"div">, "children"> {
  /** Classes of the element that scrolls, such as its greatest height. */
  className?: string;
  /**
   * Classes of the area around it, as `flex-1` to fill a panel. The rest
   * of the props, `ref` and `onScroll` among them, go to the element that
   * scrolls: a windowed list reads its scroll position.
   */
  rootClassName?: string;
  /**
   * Classes of the scrollbar, as a margin that keeps it off the resize
   * handle at the edge of a panel.
   */
  scrollbarClassName?: string;
  /**
   * Classes of the wrapper of the content, as `flex flex-1 flex-col` for
   * content that fills the height, as a note does.
   */
  contentClassName?: string;
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
 * colors of the theme, always shown while there is something to scroll,
 * so it says at a glance that the list goes on. The scrollbar of the
 * system is hidden; in WebKitGTK it is drawn over the content and grows
 * when the pointer comes near it.
 * Scrolls by the wheel, the keys and the thumb, as any other element.
 */
export function ScrollArea({
  className = "",
  rootClassName = "",
  scrollbarClassName = "",
  contentClassName = "",
  children,
  ...viewport
}: ScrollAreaProps) {
  return (
    <Base.Root
      className={`group/scroll relative flex min-h-0 flex-col ${rootClassName}`}
    >
      <Base.Viewport
        {...viewport}
        className={`min-h-0 overscroll-contain outline-none ${className}`}
      >
        {/* Watched for its size: without it, content that grows or shrinks
            in place, as a folder of the tree opened or shut, would leave
            the scrollbar as it was. Not wider than the area, as Base UI
            makes it by default: long names are cut short, never scrolled
            to the side. */}
        <Base.Content className={contentClassName} style={{ minWidth: 0 }}>
          {children}
        </Base.Content>
      </Base.Viewport>
      <Base.Scrollbar
        orientation="vertical"
        className={`flex w-3 justify-center p-0.5 ${scrollbarClassName}`}
      >
        <Base.Thumb className="w-full rounded-full bg-line-strong hover:bg-faint" />
      </Base.Scrollbar>
    </Base.Root>
  );
}
