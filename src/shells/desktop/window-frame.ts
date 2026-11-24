import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useCommands } from "../../features/commands/commands";
import { useT } from "../../features/i18n/i18n";
import { isRecordingShortcut } from "../../features/shortcuts/shortcuts";
import { log } from "../../features/log/log";

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

export interface WindowState {
  maximized: boolean;
  /** Over the whole screen (F11). */
  fullscreen: boolean;
}

/**
 * Whether the window is maximized or fills the screen, checked again
 * after every resize. Unknown at first and when the check fails: `false`.
 */
export function useWindowState(frame: WindowFrame): WindowState {
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
        (reason: unknown) =>
          log.warn("Could not read the state of the window", reason),
      );
    };
    check();
    frame.onResized(check).then(
      (unlisten) => {
        if (current) stop = unlisten;
        else unlisten();
      },
      (reason: unknown) =>
        log.warn("Could not follow the size of the window", reason),
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
          log.error("Could not paint the window background", reason),
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
      if (isRecordingShortcut()) return;
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
      log.error("Could not switch full screen", reason),
    );
}
