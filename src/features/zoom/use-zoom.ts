import { useEffect, useMemo } from "react";
import { keys, useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { preference } from "../settings/preference";
import { isRecordingShortcut } from "../shortcuts/shortcuts";
import { log } from "../log/log";

/**
 * The zoom levels, three on each side of 1, which is 100%. Past these ends
 * the interface is too small to read, or too large to hold a note.
 */
export const ZOOM_LEVELS: readonly number[] = [
  0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.4,
];

/** The scale of the interface, 1 for 100%: always one of `ZOOM_LEVELS`. */
export const zoomPreference = preference<number>("carbon.zoom", 1, (stored) =>
  ZOOM_LEVELS.includes(Number(stored)) ? Number(stored) : undefined,
);

/** Moves the zoom `steps` levels up or down, stopping at the ends. */
function step(steps: number) {
  const at = ZOOM_LEVELS.indexOf(zoomPreference.get()) + steps;
  zoomPreference.set(
    ZOOM_LEVELS[Math.min(Math.max(at, 0), ZOOM_LEVELS.length - 1)],
  );
}
const zoomIn = () => step(1);
const zoomOut = () => step(-1);
const reset = () => zoomPreference.set(1);

/**
 * How long to wait for the zoomed layout, in milliseconds, when no resize
 * comes: the scale was the same, or the WebView took longer than the call.
 */
const ZOOM_SETTLE = 150;

/** How many changes of zoom are under way: one key held down repeats. */
let holding = 0;

/**
 * Turns off every CSS transition while the zoom changes, through
 * `data-zooming` on the root element (`index.css`). The WebView counts
 * the sizes of the page anew at the new scale, a panel `20vw` or `3rem`
 * wide among them, and the panels that glide to a new width would slide
 * there instead of standing still. Returns the function to call once the
 * zoom is applied: the transitions come back after the resize it brings,
 * two frames on, when the layout has been drawn at the new scale.
 */
function holdTransitions(): () => void {
  const root = document.documentElement;
  holding++;
  root.dataset.zooming = "";
  return () => {
    let timer = 0;
    const release = () => {
      window.removeEventListener("resize", release);
      clearTimeout(timer);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (--holding === 0) delete root.dataset.zooming;
        }),
      );
    };
    window.addEventListener("resize", release);
    timer = window.setTimeout(release, ZOOM_SETTLE);
  };
}

/**
 * The zoom of the whole interface, remembered between app starts.
 * Ctrl+= (or Ctrl++) zooms in, Ctrl+- out, Ctrl+0 back to 100%; on a Mac
 * Cmd takes the place of Ctrl. The keys are found by their place too, so
 * any keyboard layout works, and so does the number pad. The palette has
 * the same as commands, and the settings a choice of the levels.
 */
export function useZoom(apply: (scale: number) => Promise<void>): void {
  const t = useT();
  const scale = zoomPreference.use();

  useEffect(() => {
    const done = holdTransitions();
    apply(scale)
      .catch((reason: unknown) =>
        log.error("Could not zoom the interface", reason),
      )
      .finally(done);
  }, [apply, scale]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = event.ctrlKey || event.metaKey;
      if (!command || event.altKey || isRecordingShortcut()) return;
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
  }, []);

  useCommands(
    useMemo(
      () => [
        {
          id: "zoom.in",
          title: t("zoom.in"),
          shortcut: keys("Mod+="),
          run: zoomIn,
        },
        {
          id: "zoom.out",
          title: t("zoom.out"),
          shortcut: keys("Mod+-"),
          run: zoomOut,
        },
        {
          id: "zoom.reset",
          title: t("zoom.reset"),
          shortcut: keys("Mod+0"),
          run: reset,
        },
      ],
      [t],
    ),
  );
}
