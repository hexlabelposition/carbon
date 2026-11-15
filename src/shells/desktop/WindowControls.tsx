import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useT } from "../../features/i18n/i18n";

/** The window, as the title bar acts on it. */
export interface WindowFrame {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** Calls `listener` after every resize; resolves to a function that stops it. */
  onResized(listener: () => void): Promise<() => void>;
  /**
   * Paints what shows where the page is not drawn yet, as a CSS hex color:
   * `#rrggbbaa` for one that is see-through.
   */
  setBackground(color: string): Promise<void>;
}

/**
 * Whether the window is maximized, checked again after every resize.
 * Unknown at first and when the check fails: then `false`.
 */
function useMaximized(frame: WindowFrame): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let current = true;
    let stop: (() => void) | null = null;
    const check = () => {
      frame.isMaximized().then(
        (value) => {
          if (current) setMaximized(value);
        },
        // Unknown: keep what is known.
        () => {},
      );
    };
    check();
    frame.onResized(check).then(
      (unlisten) => {
        if (current) stop = unlisten;
        else unlisten();
      },
      () => {},
    );
    return () => {
      current = false;
      stop?.();
    };
  }, [frame]);

  return maximized;
}

/**
 * Shapes the window: rounded corners, square when it is maximized
 * (`data-window` on the root element, see `index.css`).
 *
 * A maximized window is painted in the background of the app, in the
 * theme that is on: while it is being resized, the part the page has not
 * been drawn into yet shows it, not the grey of the system. A window that
 * is not maximized stays transparent behind the page, or its corners
 * would show that color.
 */
export function useWindowShape(frame: WindowFrame): void {
  const maximized = useMaximized(frame);

  // Before the first paint: the first frame already has the rounded
  // corners, not a square one that turns round a moment later.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.window = maximized ? "maximized" : "normal";
    return () => {
      delete root.dataset.window;
    };
  }, [maximized]);

  useEffect(() => {
    const paint = () => {
      const color = maximized
        ? getComputedStyle(document.documentElement)
            .getPropertyValue("--cb-bg")
            .trim()
        : TRANSPARENT;
      if (color === "") return;
      frame
        .setBackground(color)
        .catch((reason: unknown) =>
          console.error("Could not paint the window background", reason),
        );
    };
    paint();
    // The theme follows the system, or `data-theme` on the root element.
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", paint);
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      dark.removeEventListener("change", paint);
      observer.disconnect();
    };
  }, [frame, maximized]);
}

const TRANSPARENT = "#00000000";

/**
 * Room to leave at the right end of the top row, under the window buttons:
 * three square buttons as tall as the row, 48 pixels.
 */
export const WINDOW_CONTROLS_ROOM = "pr-[144px]";

/**
 * Minimize, maximize or restore, and close, in the top right corner of the
 * window, over the top row of the layout. The element at the right end of
 * that row leaves `WINDOW_CONTROLS_ROOM` free for them.
 */
export function WindowControls({ frame }: { frame: WindowFrame }) {
  const t = useT();
  const maximized = useMaximized(frame);

  const act = (action: () => Promise<void>) => () => {
    action().catch((reason: unknown) =>
      console.error("The window did not do it", reason),
    );
  };

  return (
    // Marked, so a dialog can tell a press here from one beside it: the
    // window buttons work while the settings are open.
    <div
      data-window-controls
      className="fixed top-0 right-0 z-40 flex h-12 border-b border-line bg-panel"
    >
      <ControlButton label={t("window.minimize")} onClick={act(frame.minimize)}>
        <path d="M0 5.5h10" shapeRendering="crispEdges" />
      </ControlButton>
      <ControlButton
        label={maximized ? t("window.restore") : t("window.maximize")}
        onClick={act(frame.toggleMaximize)}
      >
        {maximized ? (
          <g shapeRendering="crispEdges">
            <rect x="0.5" y="2.5" width="7" height="7" />
            <path d="M2.5 2.5v-2h7v7h-2" />
          </g>
        ) : (
          <rect
            x="0.5"
            y="0.5"
            width="9"
            height="9"
            shapeRendering="crispEdges"
          />
        )}
      </ControlButton>
      <ControlButton
        label={t("window.close")}
        danger
        onClick={act(frame.close)}
      >
        <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  /** Red on hover: the button that closes the window. */
  danger?: boolean;
  onClick: () => void;
  /** The shapes of the icon. */
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-full w-12 items-center justify-center text-muted transition-colors duration-100 outline-none focus-visible:ring-1 focus-visible:ring-line-strong focus-visible:ring-inset ${
        danger
          ? "hover:bg-danger hover:text-on-danger active:bg-danger/80"
          : "hover:bg-selected hover:text-fg active:bg-line-strong"
      }`}
      onClick={onClick}
    >
      {/* 10 by 10 pixels with 1-pixel lines, as the window buttons of
          Windows and VS Code: lines on whole pixels stay sharp. */}
      <svg
        viewBox="0 0 10 10"
        width="10"
        height="10"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        {children}
      </svg>
    </button>
  );
}

/**
 * An empty top row that the window is dragged by, for views without a row
 * of their own there: the start screen, a workspace with no note open.
 */
export function DragStrip({
  room = false,
  children,
}: {
  room?: boolean;
  /** Buttons at its start, such as the one of the left panel. */
  children?: ReactNode;
}) {
  return (
    <div
      data-tauri-drag-region
      className={`flex h-12 shrink-0 items-center border-b border-line bg-panel px-1.5 ${
        room ? WINDOW_CONTROLS_ROOM : ""
      }`}
    >
      {children}
    </div>
  );
}
