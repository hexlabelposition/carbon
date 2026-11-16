/*
 * The Carbon logo, drawn from `carbon-horizontal-for-*-bg.svg` of the design
 * sources. Its colors are tokens (`--cb-logo-*` in tokens.css), so one
 * drawing serves the light and the dark theme.
 */

/** A hexagon of the mark, 62 from its center to a corner. */
const HEXAGON = "62,0 31,53.7 -31,53.7 -62,0 -31,-53.7 31,-53.7";

/**
 * The seven cells of the mark, each with the token of its color and, for the
 * six around the center, its place on the ring: clockwise from the top.
 */
const CELLS: readonly {
  x: number;
  y: number;
  color: string;
  ring?: number;
}[] = [
  { x: 0, y: -117, color: "var(--cb-logo-top)", ring: 0 },
  { x: -101.3, y: -58.5, color: "var(--cb-logo-upper)", ring: 5 },
  { x: 101.3, y: -58.5, color: "var(--cb-logo-upper)", ring: 1 },
  { x: -101.3, y: 58.5, color: "var(--cb-logo-lower)", ring: 4 },
  { x: 101.3, y: 58.5, color: "var(--cb-logo-lower)", ring: 2 },
  { x: 0, y: 117, color: "var(--cb-logo-bottom)", ring: 3 },
  { x: 0, y: 0, color: "var(--cb-logo-center)" },
];

/** Seconds the light takes to go once around the ring (`cb-logo-wave`). */
const WAVE_SECONDS = 6;

/** "Carbon", in the units of the source drawing. */
const WORDMARK =
  "M260.15 145.81C278.14 145.81 291.26 134.43 293.78 118.3H281.2C279.12 128.69 270.43 134.43 260.26 134.43C246.31 134.43 235.81 123.82 235.81 104.02C235.81 84.34 246.26 73.51 260.26 73.51C270.43 73.51 279.12 79.2 281.2 89.59H293.72C290.99 72.31 277.32 62.13 260.15 62.13C239.04 62.13 223.45 77.88 223.45 104.02C223.45 130.06 238.98 145.81 260.15 145.81ZM322.38 146.08C332.28 146.08 338.08 141.1 340.43 136.34H341.03V144.71H352.68V104.13C352.68 86.47 338.62 82.81 328.78 82.81C317.9 82.81 307.62 87.07 303.46 98.01L314.78 100.96C316.48 96.81 320.96 92.59 328.95 92.59C336.6 92.59 340.65 96.53 340.65 103.31V103.64C340.65 107.96 336 107.91 325.23 109.17C313.69 110.48 301.71 113.54 301.71 127.43C301.71 139.46 310.73 146.08 322.38 146.08ZM325.06 136.4C318.34 136.4 313.52 133.39 313.52 127.59C313.52 121.31 319.1 119.01 325.88 118.08C329.6 117.59 338.9 116.6 340.7 114.85V122.67C340.7 129.84 334.85 136.4 325.06 136.4ZM366.63 144.71H378.66V107.58C378.66 99.54 384.78 93.85 393.21 93.85C395.72 93.85 398.62 94.29 399.49 94.51V83.02C398.24 82.86 395.94 82.7 394.41 82.7C387.24 82.7 381.17 86.74 378.93 93.42H378.28V83.57H366.63ZM438.05 145.92C452.93 145.92 463.59 134.05 463.59 114.31C463.59 94.4 452.71 82.81 438.05 82.81C426.62 82.81 422.52 89.75 420.39 93.52H419.73V63.23H407.7V144.71H419.4V135.14H420.39C422.52 139.02 426.95 145.92 438.05 145.92ZM435.37 135.69C425.2 135.69 419.51 126.94 419.51 114.2C419.51 101.51 425.04 93.03 435.37 93.03C445.98 93.03 451.29 102.17 451.29 114.2C451.29 126.34 445.82 135.69 435.37 135.69ZM500.4 145.97C517.62 145.97 529 133.34 529 114.47C529 95.44 517.62 82.81 500.4 82.81C483.17 82.81 471.85 95.44 471.85 114.47C471.85 133.34 483.17 145.97 500.4 145.97ZM500.4 135.8C489.35 135.8 484.1 126.06 484.1 114.47C484.1 102.71 489.35 92.98 500.4 92.98C511.55 92.98 516.8 102.77 516.8 114.47C516.8 126.06 511.55 135.8 500.4 135.8ZM552.13 108.51C552.13 98.83 558.15 93.31 566.35 93.31C574.34 93.31 579.26 98.56 579.26 107.36V144.71H591.29V105.88C591.29 90.79 582.98 82.81 570.51 82.81C561.87 82.81 555.47 86.69 551.64 95.33L551.59 83.57H540.1V144.71H552.13Z";

/**
 * The cells, each in its color, or all in `fill`. With `wave` the light runs
 * clockwise around the ring: each cell walks through the shades of the ring
 * (`--cb-logo-wave-*`, stronger than the still ones), a sixth of a turn
 * behind the one before it, so the first frame is laid out as the still mark.
 */
function Cells({ fill, wave = false }: { fill?: string; wave?: boolean }) {
  return CELLS.map(({ x, y, color, ring }) => (
    <polygon
      key={`${x},${y}`}
      fill={fill ?? color}
      transform={`translate(${x},${y})`}
      points={HEXAGON}
      className={wave && ring !== undefined ? "cb-logo-wave" : undefined}
      style={
        wave && ring !== undefined
          ? {
              animationDuration: `${WAVE_SECONDS}s`,
              animationDelay: `${(-(6 - ring) * WAVE_SECONDS) / 6}s`,
            }
          : undefined
      }
    />
  ));
}

/**
 * The mark alone: seven hexagons, a little taller than wide. Sized by
 * `className`. As a `shadow` every cell is in the color of the text, for a
 * watermark: give it with a `text-*` class.
 */
export function CarbonMark({
  className,
  shadow = false,
}: {
  className?: string;
  shadow?: boolean;
}) {
  return (
    <svg viewBox="-164 -171 328 342" className={className} aria-hidden="true">
      <Cells fill={shadow ? "currentColor" : undefined} />
    </svg>
  );
}

/**
 * The mark with "Carbon" beside it. Sized by `className`; its width is
 * 3.55 times its height. `label` names it for screen readers. `animated`
 * lets the light run around the cells, unless the system asks for less
 * motion.
 */
export function CarbonLogo({
  className,
  label = "Carbon",
  animated = false,
}: {
  className?: string;
  label?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="24 24 568 160"
      className={className}
      role="img"
      aria-label={label}
    >
      <g transform="translate(100.64,104) scale(0.46729)">
        <Cells wave={animated} />
      </g>
      <path fill="var(--cb-logo-text)" d={WORDMARK} />
    </svg>
  );
}
