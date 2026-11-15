import { useEffect, useState, type ReactNode } from "react";

/** The window, as the title bar acts on it. */
export interface WindowFrame {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** Calls `listener` after every resize; resolves to a function that stops it. */
  onResized(listener: () => void): Promise<() => void>;
  /** Paints what shows where the page is not drawn yet, as a CSS hex color. */
  setBackground(color: string): Promise<void>;
}

/**
 * Keeps the window background the background of the app, in the theme
 * that is on: while the window is being resized, the part the page has
 * not been drawn into yet shows it, not the grey of the system.
 */
export function useWindowBackground(frame: WindowFrame): void {
  useEffect(() => {
    const paint = () => {
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue("--cb-bg")
        .trim();
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
  }, [frame]);
}

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
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let current = true;
    let stop: (() => void) | null = null;
    const check = () => {
      frame.isMaximized().then(
        (value) => {
          if (current) setMaximized(value);
        },
        // Unknown: the button keeps the icon it has.
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

  const act = (action: () => Promise<void>) => () => {
    action().catch((reason: unknown) =>
      console.error("The window did not do it", reason),
    );
  };

  return (
    <div className="fixed top-0 right-0 z-40 flex h-12 border-b border-line bg-panel">
      <ControlButton label="Minimize" onClick={act(frame.minimize)}>
        <path d="M0 5.5h10" shapeRendering="crispEdges" />
      </ControlButton>
      <ControlButton
        label={maximized ? "Restore" : "Maximize"}
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
      <ControlButton label="Close" danger onClick={act(frame.close)}>
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
export function DragStrip({ room = false }: { room?: boolean }) {
  return (
    <div
      data-tauri-drag-region
      className={`h-12 shrink-0 border-b border-line bg-panel ${
        room ? WINDOW_CONTROLS_ROOM : ""
      }`}
    />
  );
}
