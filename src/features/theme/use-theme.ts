import { useLayoutEffect, useMemo } from "react";
import { useCommands } from "../commands/commands";
import { oneOf, preference } from "../settings/preference";

/** The theme the user chose: one of the two, or the one of the system. */
export type Theme = "system" | "light" | "dark";

/** The themes, in the order the settings offer them. */
export const THEMES: readonly Theme[] = ["system", "light", "dark"];

/** The theme setting: the settings dialog and the commands set it. */
export const themePreference = preference<Theme>(
  "carbon.theme",
  "system",
  oneOf(THEMES),
);

/**
 * Applies the theme setting, and offers the commands "Theme: Light",
 * "Theme: Dark" and "Theme: Follow system". The theme is `data-theme` on
 * the root element; the tokens follow it (tokens.css).
 */
export function useTheme(): void {
  const theme = themePreference.use();

  // Before the paint, so the app does not show in the other theme first.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  useCommands(
    useMemo(
      () => [
        {
          id: "theme.light",
          title: "Theme: Light",
          run: () => themePreference.set("light"),
        },
        {
          id: "theme.dark",
          title: "Theme: Dark",
          run: () => themePreference.set("dark"),
        },
        {
          id: "theme.system",
          title: "Theme: Follow system",
          run: () => themePreference.set("system"),
        },
      ],
      [],
    ),
  );
}
