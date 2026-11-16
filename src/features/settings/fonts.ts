import { useLayoutEffect } from "react";
import { oneOf, preference } from "./preference";

/** A font that can be chosen for the interface or for monospace text. */
export interface FontChoice {
  value: string;
  /** Its name; `null` for the system one, which is named in the language. */
  name: string | null;
  /**
   * The families it is installed under, such as its Nerd Font build;
   * none for the ones that are always there.
   */
  families: readonly string[];
}

/**
 * The fonts of the interface: Inter, which comes with the app, the font
 * of the system, and well-known ones the system may have.
 */
export const UI_FONTS: readonly FontChoice[] = [
  { value: "inter", name: "Inter", families: [] },
  { value: "system", name: null, families: [] },
  { value: "noto", name: "Noto Sans", families: ["Noto Sans"] },
  { value: "fira", name: "Fira Sans", families: ["Fira Sans"] },
  { value: "cantarell", name: "Cantarell", families: ["Cantarell"] },
  { value: "ubuntu", name: "Ubuntu", families: ["Ubuntu"] },
  { value: "roboto", name: "Roboto", families: ["Roboto"] },
  { value: "plex", name: "IBM Plex Sans", families: ["IBM Plex Sans"] },
  { value: "open", name: "Open Sans", families: ["Open Sans"] },
];

/**
 * The monospace fonts: for code in notes, and for the note text when it
 * is set to monospace. JetBrains Mono comes with the app.
 */
export const MONO_FONTS: readonly FontChoice[] = [
  { value: "jetbrains", name: "JetBrains Mono", families: [] },
  { value: "system", name: null, families: [] },
  {
    value: "fira",
    name: "Fira Code",
    families: ["Fira Code", "FiraCode Nerd Font"],
  },
  {
    value: "cascadia",
    name: "Cascadia Code",
    families: ["Cascadia Code", "CaskaydiaCove Nerd Font"],
  },
  {
    value: "source",
    name: "Source Code Pro",
    families: ["Source Code Pro", "SauceCodePro Nerd Font"],
  },
  { value: "hack", name: "Hack", families: ["Hack", "Hack Nerd Font"] },
  {
    value: "iosevka",
    name: "Iosevka",
    families: ["Iosevka", "Iosevka Nerd Font"],
  },
  {
    value: "ubuntu",
    name: "Ubuntu Mono",
    families: ["Ubuntu Mono", "UbuntuMono Nerd Font"],
  },
  {
    value: "dejavu",
    name: "DejaVu Sans Mono",
    families: ["DejaVu Sans Mono", "DejaVuSansM Nerd Font"],
  },
];

export const uiFontPreference = preference<string>(
  "carbon.font.ui",
  "inter",
  oneOf(UI_FONTS.map((font) => font.value)),
);

export const monoFontPreference = preference<string>(
  "carbon.font.mono",
  "jetbrains",
  oneOf(MONO_FONTS.map((font) => font.value)),
);

/**
 * The CSS font list of a choice: its families, then the font that comes
 * with the app (`bundled`), which stands in where they are missing.
 */
function fontFamily(font: FontChoice, bundled: string, system: string): string {
  if (font.value === "system") return system;
  return [...font.families.map((family) => `"${family}"`), bundled].join(", ");
}

const installed = new Map<readonly FontChoice[], readonly FontChoice[]>();

/**
 * The choices of `fonts` this system has, worked out once: the ones that
 * are always there, and the others if one of their families is installed.
 */
export function availableFonts(
  fonts: readonly FontChoice[],
): readonly FontChoice[] {
  let found = installed.get(fonts);
  if (found === undefined) {
    found = fonts.filter(
      (font) => font.families.length === 0 || font.families.some(isInstalled),
    );
    installed.set(fonts, found);
  }
  return found;
}

/**
 * Whether the system has the font `family`: text in it, with a serif font
 * to fall back on, is as wide as in that serif font only if it is not
 * there. Sans-serif and monospace fonts are far from serif ones in width.
 */
function isInstalled(family: string): boolean {
  const context = document.createElement("canvas").getContext("2d");
  if (context === null) return false;
  const sample = "mmmmmmmmmmlli1|WW";
  context.font = "32px serif";
  const fallback = context.measureText(sample).width;
  context.font = `32px "${family}", serif`;
  return context.measureText(sample).width !== fallback;
}

/**
 * Applies the chosen fonts as CSS variables on the root element:
 * `--cb-ui-font` for the interface, `--cb-mono-font` for monospace text.
 * Their defaults are in index.css.
 */
export function useFonts(): void {
  const ui = uiFontPreference.use();
  const mono = monoFontPreference.use();

  // Before the paint, so the app never shows in the default fonts first.
  useLayoutEffect(() => {
    const { style } = document.documentElement;
    const uiFont = UI_FONTS.find((f) => f.value === ui) ?? UI_FONTS[0];
    const monoFont = MONO_FONTS.find((f) => f.value === mono) ?? MONO_FONTS[0];
    style.setProperty(
      "--cb-ui-font",
      fontFamily(uiFont, "var(--font-sans)", "system-ui, sans-serif"),
    );
    style.setProperty(
      "--cb-mono-font",
      fontFamily(monoFont, "var(--font-mono)", "ui-monospace, monospace"),
    );
  }, [ui, mono]);
}
