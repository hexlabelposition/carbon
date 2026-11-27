import { useEffect } from "react";
import { oneOf, preference } from "../../features/settings/preference";

/**
 * How the side panels and the toolbar slide (`SlidePanel`), and the
 * columns of a split view with them: the time and the curve, one pair to
 * open and one to shut. CSS reads them from the root element:
 * `--cb-slide-duration` and `--cb-slide-ease`, which follow the way the
 * last panel went (`data-slide` on the root, `index.css`). Their values
 * until a dev build picks others are there too.
 */
export interface SlideCurve {
  id: string;
  label: string;
  /** Opening: the CSS easing. */
  open: string;
  /** Shutting: the CSS easing. */
  close: string;
  /** How long shutting takes beside opening. */
  closeScale: number;
}

/** Curves to compare in the dev tools. */
export const SLIDE_CURVES: readonly SlideCurve[] = [
  {
    id: "ease-out",
    label: "ease-out (before)",
    open: "cubic-bezier(0, 0, 0.2, 1)",
    close: "cubic-bezier(0, 0, 0.2, 1)",
    closeScale: 1,
  },
  {
    id: "emphasized",
    label: "Emphasized (now)",
    open: "cubic-bezier(0.2, 0, 0, 1)",
    close: "cubic-bezier(0.2, 0, 0, 1)",
    closeScale: 1,
  },
  {
    id: "in-out",
    label: "ease-in-out",
    open: "cubic-bezier(0.4, 0, 0.2, 1)",
    close: "cubic-bezier(0.4, 0, 0.2, 1)",
    closeScale: 1,
  },
  {
    id: "split",
    label: "Decelerate / accelerate",
    open: "cubic-bezier(0.2, 0, 0, 1)",
    close: "cubic-bezier(0.3, 0, 0.8, 0.15)",
    closeScale: 0.8,
  },
  {
    id: "sheet",
    label: "Sheet (iOS)",
    open: "cubic-bezier(0.32, 0.72, 0, 1)",
    close: "cubic-bezier(0.32, 0.72, 0, 1)",
    closeScale: 1,
  },
  {
    id: "linear",
    label: "linear",
    open: "linear",
    close: "linear",
    closeScale: 1,
  },
];

/** Times to compare, in milliseconds; the last to watch the curve. */
export const SLIDE_DURATIONS: readonly number[] = [
  150, 200, 250, 300, 400, 1000,
];

/** The curve in use, as in `index.css`. */
const DEFAULT_CURVE = SLIDE_CURVES[1]!;
const DEFAULT_DURATION = 250;

export const slideCurvePreference = preference<string>(
  "carbon.dev.slideCurve",
  DEFAULT_CURVE.id,
  oneOf(SLIDE_CURVES.map((curve) => curve.id)),
);

export const slideDurationPreference = preference<number>(
  "carbon.dev.slideDuration",
  DEFAULT_DURATION,
  (stored) =>
    SLIDE_DURATIONS.includes(Number(stored)) ? Number(stored) : undefined,
);

/** The curve and the time in use: the defaults, but in a dev build. */
function current(): { curve: SlideCurve; duration: number } {
  if (!import.meta.env.DEV) {
    return { curve: DEFAULT_CURVE, duration: DEFAULT_DURATION };
  }
  const id = slideCurvePreference.get();
  return {
    curve: SLIDE_CURVES.find((curve) => curve.id === id) ?? DEFAULT_CURVE,
    duration: slideDurationPreference.get(),
  };
}

/** How long a panel takes to shut, in milliseconds. */
export function slideCloseMs(): number {
  const { curve, duration } = current();
  return Math.round(duration * curve.closeScale);
}

/**
 * A panel starts to open or to shut: what glides from now on (the panel,
 * the columns beside it) takes the time and the curve of that way.
 */
export function setSlideDirection(open: boolean): void {
  document.documentElement.dataset.slide = open ? "open" : "close";
}

/**
 * In a dev build, puts the curve and the time picked in the dev tools on
 * the root element. In a release build the values of `index.css` stand.
 */
export function useSlideMotion(): void {
  const curveId = slideCurvePreference.use();
  const duration = slideDurationPreference.use();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const { curve } = current();
    const { style } = document.documentElement;
    style.setProperty("--cb-slide-open-duration", `${duration}ms`);
    style.setProperty("--cb-slide-open-ease", curve.open);
    style.setProperty("--cb-slide-close-duration", `${slideCloseMs()}ms`);
    style.setProperty("--cb-slide-close-ease", curve.close);
  }, [curveId, duration]);
}
