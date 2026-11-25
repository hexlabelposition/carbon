import type { IndexStatus } from "@carbon/core";
import { timing } from "./timing";
import { readySinceStart, seconds } from "./index-timing";
import { Tooltip } from "../ui/Tooltip";

/**
 * How long the startup scan took, where it waited, and how long after the
 * page began to load the vault was ready: for measuring the budgets
 * (C-602). The sidebar of a build made with `VITE_CARBON_TIMING=1` shows
 * it; the dev tools show the same as a table. Not translated, as the dev
 * tools.
 */
export function IndexTiming({ status }: { status: IndexStatus }) {
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
