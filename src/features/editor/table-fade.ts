/** How wide the fade is on a side of a table with more of it hidden. */
export const FADE = 32;

/** How long a fade takes to come in or go, in milliseconds. */
const FADE_MS = 180;

/**
 * The widths of the fades, as lengths the browser knows how to change
 * bit by bit: a property it does not know is swapped at once, so a fade
 * would snap in and out instead of easing.
 */
const PROPERTIES = ["--cm-fade-left", "--cm-fade-right"];

let registered = false;

/** Registers the widths of the fades, once; not where there is no CSS. */
function register(): void {
  if (registered || typeof CSS === "undefined" || !("registerProperty" in CSS))
    return;
  registered = true;
  for (const name of PROPERTIES) {
    try {
      CSS.registerProperty({
        name,
        syntax: "<length>",
        inherits: false,
        initialValue: "0px",
      });
    } catch {
      // Registered already, as after a reload of the module in development.
    }
  }
}

const GRADIENT =
  "linear-gradient(to right, transparent, #000 var(--cm-fade-left), #000 calc(100% - var(--cm-fade-right)), transparent)";

/**
 * What a table that scrolls has for its fades, put in its own style: the
 * mask, by the widths of the fades, none at first, and how they ease.
 */
export function fadeBase(): Record<string, string> {
  register();
  return {
    "--cm-fade-left": "0px",
    "--cm-fade-right": "0px",
    maskImage: GRADIENT,
    WebkitMaskImage: GRADIENT,
    transition: PROPERTIES.map((name) => `${name} ${FADE_MS}ms ease-out`).join(
      ", ",
    ),
  };
}

/**
 * The styles of the fades of a table that scrolls, for a theme: `base`
 * selects it, `left` and `right` are what it has while more of it is out
 * of sight on that side. Each fade eases in and out as the table scrolls
 * to or from its end; at once if the system asks for less motion.
 */
export function fadeStyles(
  base: string,
  left: string,
  right: string,
): Record<string, Record<string, string | Record<string, string>>> {
  return {
    [`${base}${left}`]: { "--cm-fade-left": `${FADE}px` },
    [`${base}${right}`]: { "--cm-fade-right": `${FADE}px` },
    "@media (prefers-reduced-motion: reduce)": {
      [base]: { transition: "none" },
    },
  };
}
