import { useEffect, useMemo } from "react";
import { keys, useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { preference } from "../settings/preference";

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
    apply(scale).catch((reason: unknown) =>
      console.error("Could not zoom the interface", reason),
    );
  }, [apply, scale]);

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
