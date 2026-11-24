import type { IndexStatus } from "@carbon/core";
import { useEffect } from "react";

/** Logs the timings to the console once the startup scan is over. */
export function useLogIndexTiming(status: IndexStatus): void {
  const ready = status.state === "ready" ? status : null;
  useEffect(() => {
    if (ready === null) return;
    const sinceStart = readySinceStart(ready.doneAt);
    console.info(
      `[carbon] ${ready.notes} notes, ${ready.indexed} indexed in ` +
        `${seconds(ready.ms)}, ready ${seconds(sinceStart)} after the page ` +
        "began to load",
      ready.waits,
    );
  }, [ready]);
}

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
