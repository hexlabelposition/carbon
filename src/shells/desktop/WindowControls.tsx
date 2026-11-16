import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCommands } from "../../features/commands/commands";
import { useT } from "../../features/i18n/i18n";
import { APP_MARK_ROOM } from "./AppMark";

/** The window, as the title bar acts on it. */
export interface WindowFrame {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  toggleFullscreen(): Promise<void>;
  /** Calls `listener` after every resize; resolves to a function that stops it. */
  onResized(listener: () => void): Promise<() => void>;
  /**
   * Paints what shows where the page is not drawn yet, as a CSS hex color:
   * `#rrggbbaa` for one that is see-through.
   */
  setBackground(color: string): Promise<void>;
}

interface WindowState {
  maximized: boolean;
  /** Over the whole screen (F11). */
  fullscreen: boolean;
}

/**
 * Whether the window is maximized or fills the screen, checked again
 * after every resize. Unknown at first and when the check fails: `false`.
 */
function useWindowState(frame: WindowFrame): WindowState {
  const [state, setState] = useState<WindowState>({
    maximized: false,
    fullscreen: false,
  });

  useEffect(() => {
    let current = true;
    let stop: (() => void) | null = null;
    const check = () => {
      Promise.all([frame.isMaximized(), frame.isFullscreen()]).then(
        ([maximized, fullscreen]) => {
          if (!current) return;
          setState((old) =>
            old.maximized === maximized && old.fullscreen === fullscreen
              ? old
              : { maximized, fullscreen },
          );
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

  return state;
}

/**
 * Shapes the window: rounded corners, square when it is maximized or
 * fills the screen
 * (`data-window` on the root element, see `index.css`).
 *
 * A maximized window is painted in the background of the app, in the
 * theme that is on: while it is being resized, the part the page has not
 * been drawn into yet shows it, not the grey of the system. A window that
 * is not maximized stays transparent behind the page, or its corners
 * would show that color.
 */
export function useWindowShape(frame: WindowFrame): void {
  // Square to the edges of the screen: maximized, or over the whole of it.
  const { maximized: isMaximized, fullscreen } = useWindowState(frame);
  const maximized = isMaximized || fullscreen;

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
 * F11 fills the screen with the window, or gives the screen back; the
 * palette has the same as a command.
 */
export function useFullscreenShortcut(frame: WindowFrame): void {
  const t = useT();
  useCommands(
    useMemo(
      () => [
        {
          id: "window.fullscreen",
          title: t("window.fullscreen"),
          shortcut: "F11",
          run: () => toggleFullscreen(frame),
        },
      ],
      [t, frame],
    ),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "F11" || event.ctrlKey || event.altKey) return;
      if (event.metaKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      toggleFullscreen(frame);
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [frame]);
}

function toggleFullscreen(frame: WindowFrame): void {
  frame
    .toggleFullscreen()
    .catch((reason: unknown) =>
      console.error("Could not switch full screen", reason),
    );
}

/**
 * Room to leave at the right end of the top row, under the buttons in the
 * top right corner: as wide as they are, which `WindowControls` keeps in
 * `--cb-controls-room` (with the panel buttons or without).
 */
export const WINDOW_CONTROLS_ROOM = "pr-(--cb-controls-room)";

/**
 * Minimize, maximize or restore, and close, in the top right corner of the
 * window, over the top row of the layout, with `panels` before them: the
 * buttons of the side panels. The element at the right end of that row
 * leaves `WINDOW_CONTROLS_ROOM` free for them.
 */
export function WindowControls({
  frame,
  panels,
}: {
  frame: WindowFrame;
  panels?: ReactNode;
}) {
  const t = useT();
  const { maximized, fullscreen } = useWindowState(frame);
  const group = useRef<HTMLDivElement>(null);

  // The room the top row leaves: as wide as the buttons are now. Before
  // the paint, so the row never runs under them.
  useLayoutEffect(() => {
    const element = group.current;
    if (element === null) return;
    const { style } = document.documentElement;
    const measure = () =>
      style.setProperty("--cb-controls-room", `${element.offsetWidth}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      style.removeProperty("--cb-controls-room");
    };
  }, []);

  const act = (action: () => Promise<void>) => () => {
    action().catch((reason: unknown) =>
      console.error("The window did not do it", reason),
    );
  };

  return (
    // Marked, so a dialog can tell a press here from one beside it: the
    // window buttons work while the settings are open.
    <div
      ref={group}
      data-window-controls
      className="fixed top-0 right-0 z-40 flex h-bar border-b border-line bg-panel"
    >
      {panels !== undefined && (
        // Set off by a line at each side: from the tabs or the right panel
        // before it, and from the buttons of the window after it. Over the
        // whole screen those fold away, and the line after them fades.
        <div
          className={`flex border-x border-l-line px-1.5 transition-colors duration-200 ease-out motion-reduce:transition-none ${
            fullscreen ? "border-r-transparent" : "border-r-line"
          }`}
        >
          {panels}
        </div>
      )}
      {/* Over the whole screen (F11) the window has nothing to minimize or
          restore: the buttons fade and fold away, and the row takes back
          their room as they go. */}
      <div
        inert={fullscreen}
        className="flex overflow-hidden transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none"
        // Three buttons of `w-bar`.
        style={{
          width: fullscreen ? 0 : "calc(var(--spacing-bar) * 3)",
          opacity: fullscreen ? 0 : 1,
        }}
      >
        <ControlButton
          label={t("window.minimize")}
          onClick={act(frame.minimize)}
        >
          <path d="M0 5.5h11" shapeRendering="crispEdges" />
        </ControlButton>
        <ControlButton
          label={maximized ? t("window.restore") : t("window.maximize")}
          onClick={act(frame.toggleMaximize)}
        >
          {maximized ? (
            <g shapeRendering="crispEdges">
              <rect x="0.5" y="2.5" width="8" height="8" />
              <path d="M2.5 2.5v-2h8v8h-2" />
            </g>
          ) : (
            <rect
              x="0.5"
              y="0.5"
              width="10"
              height="10"
              shapeRendering="crispEdges"
            />
          )}
        </ControlButton>
        <ControlButton
          label={t("window.close")}
          danger
          onClick={act(frame.close)}
        >
          <path d="M0.5 0.5l10 10M10.5 0.5l-10 10" />
        </ControlButton>
      </div>
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
      className={`flex h-full w-bar shrink-0 items-center justify-center text-muted transition-colors duration-100 outline-none focus-visible:ring-1 focus-visible:ring-line-strong focus-visible:ring-inset ${
        danger
          ? "hover:bg-danger hover:text-on-danger active:bg-danger/80"
          : "hover:bg-selected hover:text-fg active:bg-line-strong"
      }`}
      onClick={onClick}
    >
      {/* 11 by 11 pixels with 1-pixel lines, as the window buttons of
          Windows and VS Code: lines on whole pixels stay sharp. */}
      <svg
        viewBox="0 0 11 11"
        width="11"
        height="11"
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
  roomStart = false,
}: {
  room?: boolean;
  /** Leaves room at the start for the mark in the top left corner. */
  roomStart?: boolean;
}) {
  return (
    <div
      data-tauri-drag-region
      className={`flex h-bar shrink-0 items-center border-b border-line bg-panel px-1.5 ${
        room ? WINDOW_CONTROLS_ROOM : ""
      } ${roomStart ? APP_MARK_ROOM : ""}`}
    />
  );
}
