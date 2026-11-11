import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
} from "react";

/** Rows rendered above and below the visible ones, so scrolling has no gaps. */
const OVERSCAN = 8;

export interface VirtualRows {
  /** Pass as `ref` to the scrolling element. */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** Pass as `onScroll` to the scrolling element. */
  onScroll: (event: UIEvent<HTMLElement>) => void;
  /** Rows `first` up to, not including, `end` are worth rendering. */
  first: number;
  end: number;
  /** Height of all rows together, for the element that makes the scrollbar. */
  totalHeight: number;
  /** Scrolls just enough to make a row fully visible. */
  scrollToIndex: (index: number) => void;
}

/**
 * Windowing for a list of equal-height rows: only the rows in view are
 * rendered, so a vault with 10,000 notes scrolls like a small one.
 */
export function useVirtualRows(count: number, rowHeight: number): VirtualRows {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const observer = new ResizeObserver(() => setHeight(viewport.clientHeight));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback((event: UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const viewport = viewportRef.current;
      if (viewport === null || index < 0) return;
      const top = index * rowHeight;
      const bottom = top + rowHeight;
      if (top < viewport.scrollTop) viewport.scrollTop = top;
      else if (bottom > viewport.scrollTop + viewport.clientHeight) {
        viewport.scrollTop = bottom - viewport.clientHeight;
      }
    },
    [rowHeight],
  );

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const end = Math.min(
    count,
    Math.ceil((scrollTop + height) / rowHeight) + OVERSCAN,
  );

  return {
    viewportRef,
    onScroll,
    first,
    end,
    totalHeight: count * rowHeight,
    scrollToIndex,
  };
}
