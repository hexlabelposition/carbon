/**
 * When the scan was done (`Date.now()`), as milliseconds from the moment
 * the page began to load: the start of the app.
 */
export function readySinceStart(doneAt: number): number {
  return doneAt - performance.timeOrigin;
}

/** Milliseconds as seconds, to the hundredth: "0.42 s". */
export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}
