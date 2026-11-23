import { ScrollArea as Base } from "@base-ui/react/scroll-area";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";

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
   * Classes of the wrapper of the content, as `flex shrink-0 grow
   * flex-col` for content that fills the height, as a note does. Not
   * `flex-1`, nor a `min-h-full` alone: the wrapper would be held to the
   * height of the area, and the scrollbar, which watches its size, would
   * miss the content growing inside it.
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
export const SCROLLBAR_ROOM = "group-data-scrolls/scroll:pr-3";

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
  ref,
  ...viewport
}: ScrollAreaProps) {
  const viewportEl = useRef<HTMLDivElement | null>(null);
  const contentEl = useRef<HTMLDivElement | null>(null);
  const scrolls = useScrolls(viewportEl, contentEl);
  const rootEl = useRef<HTMLDivElement | null>(null);
  useSettling(rootEl, viewportEl, contentEl);
  const setViewport = useCallback(
    (element: HTMLDivElement | null) => {
      viewportEl.current = element;
      setRef(ref, element);
    },
    [ref],
  );
  return (
    <Base.Root
      ref={rootEl}
      data-scrolls={scrolls ? "" : undefined}
      className={`group/scroll relative flex min-h-0 flex-col ${rootClassName}`}
    >
      <Base.Viewport
        {...viewport}
        ref={setViewport}
        className={`min-h-0 overscroll-contain outline-none ${className}`}
      >
        {/* Watched for its size: without it, content that grows or shrinks
            in place, as a folder of the tree opened or shut, would leave
            the scrollbar as it was. Not wider than the area, as Base UI
            makes it by default: long names are cut short, never scrolled
            to the side. */}
        <Base.Content
          ref={contentEl}
          className={contentClassName}
          style={{ minWidth: 0 }}
        >
          {children}
        </Base.Content>
      </Base.Viewport>
      <Base.Scrollbar
        orientation="vertical"
        className={`flex w-3 justify-center p-0.5 ${
          scrolls ? "" : "hidden"
        } ${scrollbarClassName}`}
      >
        {/* While the content changes size, the thumb glides to its new
            size and place (useSettling); a scroll moves it at once. */}
        <Base.Thumb className="w-full rounded-full bg-line-strong group-data-settling/scroll:transition-[height,transform] group-data-settling/scroll:duration-200 group-data-settling/scroll:ease-out hover:bg-faint motion-reduce:transition-none" />
      </Base.Scrollbar>
    </Base.Root>
  );
}

/**
 * Whether there is something to scroll: the content taller than the area
 * by more than a pixel. Base UI takes any difference, and with the zoom
 * of the interface the height of the area is a fraction of a pixel that
 * the browser rounds down, while the content it rounds up: a scrollbar
 * then shows with nothing to scroll.
 */
/** How long the thumb glides after the content last changed size, in ms. */
const SETTLE_MS = 300;

/**
 * Marks the area `data-settling` for a moment each time its content grows
 * or shrinks, as when the text size of a note changes, so the thumb glides
 * to its new size and place instead of jumping. A note grows in steps: the
 * lines in view at once, the others when the editor has measured them, a
 * frame or a few later; the glide takes each new goal on the way. The
 * wheel, a press of the mouse or of a key ends it, so the thumb follows a
 * scroll at once.
 */
function useSettling(
  root: { current: HTMLElement | null },
  viewport: { current: HTMLElement | null },
  content: { current: HTMLElement | null },
): void {
  useEffect(() => {
    const area = root.current;
    const scroller = viewport.current;
    const inner = content.current;
    if (area === null || scroller === null || inner === null) return;
    let timer = 0;
    const end = () => {
      clearTimeout(timer);
      delete area.dataset.settling;
    };
    let first = true;
    const observer = new ResizeObserver(() => {
      // It reports the size it starts with: no change yet.
      if (first) {
        first = false;
        return;
      }
      area.dataset.settling = "";
      clearTimeout(timer);
      timer = window.setTimeout(end, SETTLE_MS);
    });
    observer.observe(inner);
    // Ctrl and the wheel change the text size: that is no scroll.
    const onUser = (event: MouseEvent | KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) end();
    };
    scroller.addEventListener("wheel", onUser, { passive: true });
    scroller.addEventListener("pointerdown", onUser);
    scroller.addEventListener("keydown", onUser);
    return () => {
      observer.disconnect();
      end();
      scroller.removeEventListener("wheel", onUser);
      scroller.removeEventListener("pointerdown", onUser);
      scroller.removeEventListener("keydown", onUser);
    };
  }, [root, viewport, content]);
}

function useScrolls(
  viewport: { current: HTMLElement | null },
  content: { current: HTMLElement | null },
): boolean {
  const [scrolls, setScrolls] = useState(false);
  useLayoutEffect(() => {
    const area = viewport.current;
    if (area === null) return;
    const measure = () => setScrolls(area.scrollHeight - area.clientHeight > 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    if (content.current !== null) observer.observe(content.current);
    return () => observer.disconnect();
  }, [viewport, content]);
  return scrolls;
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref !== null && ref !== undefined) {
    (ref as { current: T | null }).current = value;
  }
}
