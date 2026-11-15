import { useTheme } from "./use-theme";

/** Makes the theme commands work for the whole app; draws nothing. */
export function ThemeSwitch() {
  useTheme();
  return null;
}
