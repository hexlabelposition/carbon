// The theme switch in the header: light, dark or the system's. The choice
// is `data-theme` on <html>, none for the system's, and is kept between
// visits. The inline script in the layout applies it before the first paint.

const KEY = "carbon-theme";
type Theme = "light" | "dark" | "system";

function stored(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  for (const button of document.querySelectorAll<HTMLElement>(
    "[data-theme-choice]",
  )) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeChoice === theme),
    );
  }
}

apply(stored());

for (const button of document.querySelectorAll<HTMLElement>(
  "[data-theme-choice]",
)) {
  button.addEventListener("click", () => {
    const theme = (button.dataset.themeChoice ?? "system") as Theme;
    try {
      if (theme === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      // Private mode: the choice holds until the page is left.
    }
    apply(theme);
  });
}
