import { preference } from "./preference";

/**
 * Whether the toolbar at the left edge of the window is shown: switched
 * in the settings, from the palette and by its shortcut, all one setting.
 * Stored as it was while the shell kept it (`useSidePanel`).
 */
export const toolbarPreference = preference<boolean>(
  "carbon.desktop.toolbar",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/** Shows the toolbar if it is hidden, hides it if it is shown. */
export function toggleToolbar(): void {
  toolbarPreference.set(!toolbarPreference.get());
}
