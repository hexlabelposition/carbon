import { useEffect, useLayoutEffect, useState } from "react";
import { log } from "../log/log";
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

/** A font family installed on the system, as the platform lists it. */
export interface SystemFont {
  family: string;
  /** Whether a face of it is monospace. */
  monospace: boolean;
}

/**
 * A font of the system picked by its family, as a setting stores it:
 * `family:` and its name, apart from the choices named above.
 */
const FAMILY = "family:";

/** The value of a setting for the system font `family`. */
export function familyValue(family: string): string {
  return FAMILY + family;
}

/** The family a value of `familyValue` names; `null` for another value. */
export function familyOf(value: string): string | null {
  return value.startsWith(FAMILY) && value.length > FAMILY.length
    ? value.slice(FAMILY.length)
    : null;
}

/** `family` as a name in a CSS font list, quoted. */
export function cssFamily(family: string): string {
  return `"${family.replace(/["\\]/g, "\\$&")}"`;
}

/** Parses a stored font: one of `values`, or a family of the system. */
export function fontValue<T extends string>(values: readonly T[]) {
  const named = oneOf(values);
  return (stored: string): T | undefined =>
    named(stored) ?? (familyOf(stored) !== null ? (stored as T) : undefined);
}

export const uiFontPreference = preference<string>(
  "carbon.font.ui",
  "inter",
  fontValue(UI_FONTS.map((font) => font.value)),
);

export const monoFontPreference = preference<string>(
  "carbon.font.mono",
  "jetbrains",
  fontValue(MONO_FONTS.map((font) => font.value)),
);

/**
 * The CSS font list of a value of `fonts`: its families, or the family of
 * the system it names, then the font that comes with the app (`bundled`),
 * which stands in where they are missing.
 */
function fontFamily(
  fonts: readonly FontChoice[],
  value: string,
  bundled: string,
  system: string,
): string {
  const family = familyOf(value);
  if (family !== null) return `${cssFamily(family)}, ${bundled}`;
  const font = fonts.find((f) => f.value === value) ?? fonts[0];
  if (font.value === "system") return system;
  return [...font.families.map(cssFamily), bundled].join(", ");
}

/** The fonts of the system, asked for once a run: listing them is slow. */
let systemFonts: Promise<readonly SystemFont[]> | null = null;

/**
 * The font families of the system, from `list` (the platform); `null`
 * until they are listed, and empty without a platform or if it failed.
 */
export function useSystemFonts(
  list: (() => Promise<readonly SystemFont[]>) | undefined,
): readonly SystemFont[] | null {
  const [fonts, setFonts] = useState<readonly SystemFont[] | null>(null);
  useEffect(() => {
    if (list === undefined) return;
    systemFonts ??= list().catch((reason: unknown) => {
      log.error("Could not list the fonts of the system", reason);
      systemFonts = null;
      return [];
    });
    let live = true;
    void systemFonts.then((found) => {
      if (live) setFonts(found);
    });
    return () => {
      live = false;
    };
  }, [list]);
  return list === undefined ? NO_FONTS : fonts;
}

const NO_FONTS: readonly SystemFont[] = [];

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
    style.setProperty(
      "--cb-ui-font",
      fontFamily(UI_FONTS, ui, "var(--font-sans)", "system-ui, sans-serif"),
    );
    style.setProperty(
      "--cb-mono-font",
      fontFamily(
        MONO_FONTS,
        mono,
        "var(--font-mono)",
        "ui-monospace, monospace",
      ),
    );
  }, [ui, mono]);
}

/** How many fonts are laid out at a time while they warm up. */
const WARM_BATCH = 6;

/**
 * Loads the fonts of `fonts` ahead, while the list of them may be
 * opened: their names, each in its font, are laid out a few at a time
 * out of sight, between frames, so the list, which lays out every row
 * as it opens, does not wait for hundreds of font files at once. The
 * names stay laid out until the component goes, so WebKit keeps the
 * fonts in use and does not let them go from its cache.
 * `document.fonts.load` would not do: it loads only `@font-face` fonts.
 */
export function useWarmFonts(fonts: readonly SystemFont[] | null): void {
  useEffect(() => {
    if (fonts === null || fonts.length === 0) return;
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    // The size and weights of the list, so the same faces are loaded.
    host.className = "text-ui";
    Object.assign(host.style, {
      position: "fixed",
      top: "0",
      left: "-10000px",
      width: "1000px",
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.append(host);
    let next = 0;
    let timer = 0;
    const warm = () => {
      const end = Math.min(next + WARM_BATCH, fonts.length);
      for (; next < end; next++) {
        const name = document.createElement("div");
        name.textContent = fonts[next].family;
        name.style.fontFamily = cssFamily(fonts[next].family);
        host.append(name);
      }
      // Laid out now, in this task, not in the frame of a scroll.
      void host.offsetHeight;
      if (next < fonts.length) timer = window.setTimeout(warm, 16);
    };
    timer = window.setTimeout(warm, 0);
    return () => {
      window.clearTimeout(timer);
      host.remove();
    };
  }, [fonts]);
}
