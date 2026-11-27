import type { MessageKey } from "../i18n/i18n";
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

/**
 * The buttons at the top of the toolbar, which can be hidden one by one,
 * in their order: the ids of the buttons, those of their commands for
 * the ones that run a command (as `OPEN_SEARCH`).
 */
export const TOOLBAR_TOOLS: readonly { id: string; label: MessageKey }[] = [
  { id: "sidebar.explorer", label: "shell.files" },
  { id: "sidebar.tags", label: "shell.tags" },
  { id: "switcher.open", label: "switcher.open" },
  { id: "randomNote.open", label: "randomNote.open" },
  { id: "graph.toggle", label: "graph.toggle" },
  { id: "palette.open", label: "palette.open" },
];

/**
 * The tools hidden from the toolbar, by id: hidden from its menu of the
 * right button or in the settings. What they do stays in the palette
 * and on their keys. The buttons at its foot are always there.
 */
export const hiddenToolsPreference = preference<readonly string[]>(
  "carbon.desktop.hiddenTools",
  [],
  (stored) => {
    try {
      const value: unknown = JSON.parse(stored);
      return Array.isArray(value) && value.every((id) => typeof id === "string")
        ? (value as string[])
        : undefined;
    } catch {
      return undefined;
    }
  },
  (value) => JSON.stringify(value),
);

/** Shows the tool `id` on the toolbar, or hides it. */
export function setToolShown(id: string, shown: boolean): void {
  const hidden = hiddenToolsPreference.get().filter((other) => other !== id);
  hiddenToolsPreference.set(shown ? hidden : [...hidden, id]);
}
