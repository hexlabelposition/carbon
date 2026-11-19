import type { IndexStatus } from "@carbon/core";
import { useEffect } from "react";
import { timing } from "./timing";
import { Tooltip } from "../ui/Tooltip";

/**
 * How long the startup scan took, where it waited, and how long after the
 * page began to load the vault was ready: for measuring the budgets
 * (C-602). The sidebar of a build made with `VITE_CARBON_TIMING=1` shows
 * it; the dev tools show the same as a table. Not translated, as the dev
 * tools.
 */
export function IndexTiming({ status }: { status: IndexStatus }) {
  useLogIndexTiming(status);
  if (status.state !== "ready") return null;
  const sinceStart = readySinceStart(status.doneAt);
  const { list, read, parse, write } = status.waits;
  return (
    <Tooltip label="For measuring the budgets (C-602)">
      <div>
        <p>
          {status.notes} notes · {status.indexed} indexed in{" "}
          {seconds(status.ms)} · ready {seconds(sinceStart)} after start
        </p>
        {timing.shownAt !== null && timing.openedAt !== null && (
          <p>
            window shown {seconds(timing.shownAt)} after start · opened to ready{" "}
            {seconds(sinceStart - timing.openedAt)}
          </p>
        )}
        <p>
          waited: list {seconds(list)} · read {seconds(read)} · parse{" "}
          {seconds(parse)} · write {seconds(write)}
        </p>
      </div>
    </Tooltip>
  );
}

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
