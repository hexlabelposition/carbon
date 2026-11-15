import { useLayoutEffect, useMemo, useState } from "react";
import { useCommands } from "../commands/commands";

const STORAGE_KEY = "carbon.theme";

/** The theme the user chose: one of the two, or the one of the system. */
export type Theme = "system" | "light" | "dark";

/**
 * The theme of the app, chosen with the commands "Theme: Light", "Theme:
 * Dark" and "Theme: Follow system", and remembered between app starts.
 * It is `data-theme` on the root element; the tokens follow it
 * (tokens.css).
 */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(load);

  // Before the paint, so the app does not show in the other theme first.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Without storage the theme works, it only resets on the next start.
    }
  }, [theme]);

  useCommands(
    useMemo(
      () => [
        {
          id: "theme.light",
          title: "Theme: Light",
          run: () => setTheme("light"),
        },
        { id: "theme.dark", title: "Theme: Dark", run: () => setTheme("dark") },
        {
          id: "theme.system",
          title: "Theme: Follow system",
          run: () => setTheme("system"),
        },
      ],
      [],
    ),
  );

  return theme;
}

function load(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // No storage: follow the system.
  }
  return "system";
}
