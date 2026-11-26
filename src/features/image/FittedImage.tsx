import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

/** How far an image zooms in at most, from the size it fits at. */
const MAX_SCALE = 16;
/** How much one notch of the wheel zooms (pixels of a touchpad are less). */
const WHEEL_SPEED = 0.0025;
/** How much one press of "+" or "-" zooms. */
const KEY_STEP = 1.25;
/** How far the pointer moves before a press counts as a drag. */
const DRAG_SLOP = 3;

interface View {
  scale: number;
  /** How far the image is moved from the middle, in pixels on screen. */
  x: number;
  y: number;
  /** Whether the change glides: a step, not a wheel turn or a drag. */
  glide: boolean;
}

const FIT: View = { scale: 1, x: 0, y: 0, glide: true };

/** `view` moved back so the image does not leave a side of the box. */
function clamped(
  next: View,
  frame: HTMLElement | null,
  picture: HTMLImageElement | null,
): View {
  if (frame === null || picture === null) return next;
  const room = (size: number, area: number) =>
    Math.max(0, (size * next.scale - area) / 2);
  const roomX = room(picture.offsetWidth, frame.clientWidth);
  const roomY = room(picture.offsetHeight, frame.clientHeight);
  return {
    ...next,
    x: Math.min(roomX, Math.max(-roomX, next.x)),
    y: Math.min(roomY, Math.max(-roomY, next.y)),
  };
}

/**
 * `from` zoomed to `scale`, keeping the point at `at` (on screen, the
 * middle of the box without one) where it is, and the image over the box
 * as far as it can be.
 */
function zoomed(
  from: View,
  scale: number,
  at: { x: number; y: number } | null,
  frame: HTMLElement | null,
  picture: HTMLImageElement | null,
): View {
  const next = Math.min(MAX_SCALE, Math.max(1, scale));
  if (next === 1) return FIT;
  const rect = frame?.getBoundingClientRect();
  // From the middle of the box, where the image is centered.
  const px = rect && at ? at.x - (rect.left + rect.width / 2) : 0;
  const py = rect && at ? at.y - (rect.top + rect.height / 2) : 0;
  const ratio = next / from.scale;
  return clamped(
    {
      scale: next,
      x: px - (px - from.x) * ratio,
      y: py - (py - from.y) * ratio,
      glide: false,
    },
    frame,
    picture,
  );
}

/**
 * An image that fits the box it is in, centered, never bigger than it is.
 * A click beside the image calls `onClickBeside`.
 *
 * `zoomable`, as image viewers do: the wheel zooms in and out at the
 * pointer, a double click goes between the fitted size and the real one
 * (twice the fitted size for a small image), and a zoomed image is moved
 * by dragging it. With `keys` as well, "+" and "-" zoom and "0" fits it
 * again: for a viewer that has the keys to itself.
 */
export function FittedImage({
  url,
  alt,
  onClickBeside,
  zoomable = false,
  keys = false,
}: {
  url: string;
  alt: string;
  onClickBeside?: () => void;
  zoomable?: boolean;
  keys?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<View>(FIT);
  const drag = useRef<{
    id: number;
    startX: number;
    startY: number;
    from: View;
    moved: boolean;
  } | null>(null);
  /** A drag just ended: the click that follows it is not a click beside. */
  const dragged = useRef(false);
  /** Whether the image is being dragged, for the cursor. */
  const [grabbing, setGrabbing] = useState(false);
  /** `zoomed` in this box. */
  const zoom = (
    from: View,
    scale: number,
    at: { x: number; y: number } | null,
  ) => zoomed(from, scale, at, box.current, image.current);

  // Another image starts fitted.
  const [shown, setShown] = useState(url);
  if (shown !== url) {
    setShown(url);
    setView(FIT);
  }

  // "+", "-" and "0", without modifiers: Ctrl with them zooms the app.
  useEffect(() => {
    if (!zoomable || !keys) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const step = (factor: number) =>
        setView((from) => ({
          ...zoomed(
            from,
            from.scale * factor,
            null,
            box.current,
            image.current,
          ),
          glide: true,
        }));
      if (event.key === "+" || event.key === "=") {
        step(KEY_STEP);
      } else if (event.key === "-") {
        step(1 / KEY_STEP);
      } else if (event.key === "0") {
        setView(FIT);
      } else {
        return;
      }
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomable, keys]);

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (!zoomable) return;
    // Lines and pages, from a wheel on some systems, as pixels.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    const factor = Math.exp(-event.deltaY * unit * WHEEL_SPEED);
    const at = { x: event.clientX, y: event.clientY };
    setView((from) => zoom(from, from.scale * factor, at));
  }

  function onDoubleClick(event: MouseEvent<HTMLImageElement>) {
    if (!zoomable) return;
    const picture = image.current;
    if (picture === null) return;
    const at = { x: event.clientX, y: event.clientY };
    setView((from) => {
      if (from.scale > 1) return FIT;
      // The real size, or twice the fitted one if it is shown at that.
      const real = picture.naturalWidth / picture.offsetWidth;
      return { ...zoom(from, real > 1.1 ? real : 2, at), glide: true };
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!zoomable || view.scale === 1 || event.button !== 0) return;
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: view,
      moved: false,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current === null || current.id !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!current.moved) {
      // Only now: captured from the press, the click that ends a press
      // without a drag would land beside the image and close it.
      event.currentTarget.setPointerCapture(event.pointerId);
      setGrabbing(true);
    }
    current.moved = true;
    setView(
      clamped(
        {
          ...current.from,
          x: current.from.x + dx,
          y: current.from.y + dy,
          glide: false,
        },
        box.current,
        image.current,
      ),
    );
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current === null || current.id !== event.pointerId) return;
    dragged.current = current.moved;
    drag.current = null;
    setGrabbing(false);
  }

  const zoomedIn = view.scale > 1;
  return (
    <div
      ref={box}
      className="flex h-full w-full items-center justify-center overflow-hidden p-12"
      style={{
        cursor: zoomedIn ? (grabbing ? "grabbing" : "grab") : undefined,
        touchAction: zoomable ? "none" : undefined,
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(event) => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        if (event.target === event.currentTarget) onClickBeside?.();
      }}
    >
      <img
        ref={image}
        src={url}
        alt={alt}
        draggable={false}
        onDoubleClick={onDoubleClick}
        className="max-h-full max-w-full rounded-md object-contain"
        style={
          zoomable
            ? {
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                transition: view.glide ? "transform 150ms ease-out" : "none",
                cursor: zoomedIn ? undefined : "zoom-in",
              }
            : undefined
        }
      />
    </div>
  );
}
