import type { IndexStatus } from "@carbon/core";
import { useEffect } from "react";
import { timing } from "./timing";
import { Tooltip } from "../ui/Tooltip";

/**
 * How long the startup scan took, where it waited, and how long after the
 * page began to load the vault was ready: for measuring the budgets
 * (C-602). The dev tools show it, and the sidebar of a build made with
 * `VITE_CARBON_TIMING=1`. Not translated, as the dev tools.
 */
export function IndexTiming({ status }: { status: IndexStatus }) {
  const ready = status.state === "ready" ? status : null;
  // From the moment the page began to load: the start of the app.
  const sinceStart =
    ready === null ? null : ready.doneAt - performance.timeOrigin;
  useEffect(() => {
    if (ready === null || sinceStart === null) return;
    console.info(
      `[carbon] ${ready.notes} notes, ${ready.indexed} indexed in ` +
        `${seconds(ready.ms)}, ready ${seconds(sinceStart)} after the page ` +
        "began to load",
      ready.waits,
    );
  }, [ready, sinceStart]);
  if (ready === null || sinceStart === null) return null;
  const { list, read, parse, write } = ready.waits;
  return (
    <Tooltip label="For measuring the budgets (C-602)">
      <div>
        <p>
          {ready.notes} notes · {ready.indexed} indexed in {seconds(ready.ms)} ·
          ready {seconds(sinceStart)} after start
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

/** Milliseconds as seconds, to the hundredth: "0.42 s". */
export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}
