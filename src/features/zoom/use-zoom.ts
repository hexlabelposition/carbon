import { useCallback, useEffect, useMemo, useState } from "react";
import { keys, useCommands } from "../commands/commands";

/**
 * The zoom levels, the steps of browsers; 1 is 100%. Past these ends the
 * interface is too small to read, or too large to hold a note.
 */
const LEVELS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5];
const DEFAULT = LEVELS.indexOf(1);
const STORAGE_KEY = "carbon.zoom";

export interface Zoom {
  /** The scale of the interface: 1 is 100%. */
  scale: number;
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
}

/**
 * The zoom of the whole interface, remembered between app starts.
 * Ctrl+= (or Ctrl++) zooms in, Ctrl+- out, Ctrl+0 back to 100%; on a Mac
 * Cmd takes the place of Ctrl. The keys are found by their place too, so
 * any keyboard layout works, and so does the number pad. The palette has
 * the same as commands.
 */
export function useZoom(apply: (scale: number) => Promise<void>): Zoom {
  const [level, setLevel] = useState(load);
  const scale = LEVELS[level];

  useEffect(() => {
    apply(scale).catch((reason: unknown) =>
      console.error("Could not zoom the interface", reason),
    );
    try {
      localStorage.setItem(STORAGE_KEY, String(scale));
    } catch {
      // Without storage the zoom works, it only resets on the next start.
    }
  }, [apply, scale]);

  const zoomIn = useCallback(
    () => setLevel((at) => Math.min(at + 1, LEVELS.length - 1)),
    [],
  );
  const zoomOut = useCallback(() => setLevel((at) => Math.max(at - 1, 0)), []);
  const reset = useCallback(() => setLevel(DEFAULT), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = event.ctrlKey || event.metaKey;
      if (!command || event.altKey) return;
      const { key, code } = event;
      if (
        key === "+" ||
        key === "=" ||
        code === "Equal" ||
        code === "NumpadAdd"
      ) {
        zoomIn();
      } else if (key === "-" || code === "Minus" || code === "NumpadSubtract") {
        zoomOut();
      } else if (key === "0" || code === "Digit0" || code === "Numpad0") {
        reset();
      } else return;
      event.preventDefault();
      event.stopPropagation();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [zoomIn, zoomOut, reset]);

  useCommands(
    useMemo(
      () => [
        {
          id: "zoom.in",
          title: "Zoom in",
          shortcut: keys("Mod+="),
          run: zoomIn,
        },
        {
          id: "zoom.out",
          title: "Zoom out",
          shortcut: keys("Mod+-"),
          run: zoomOut,
        },
        {
          id: "zoom.reset",
          title: "Reset zoom",
          shortcut: keys("Mod+0"),
          run: reset,
        },
      ],
      [zoomIn, zoomOut, reset],
    ),
  );

  return { scale, zoomIn, zoomOut, reset };
}

/** The saved level, or 100% if none is saved or it is not a level. */
function load(): number {
  try {
    const at = LEVELS.indexOf(Number(localStorage.getItem(STORAGE_KEY)));
    return at === -1 ? DEFAULT : at;
  } catch {
    return DEFAULT;
  }
}
