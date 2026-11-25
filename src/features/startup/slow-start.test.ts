import { describe, expect, test } from "bun:test";
import type { IndexStatus } from "@carbon/core";
import { slowStart } from "./slow-start";

/** A vault ready `readyAt` ms after the start of the app. */
function ready(
  readyAt: number,
  notes: number,
  indexed: number,
): Extract<IndexStatus, { state: "ready" }> {
  return {
    state: "ready",
    notes,
    indexed,
    ms: 0,
    doneAt: performance.timeOrigin + readyAt,
    waits: { list: 0, read: 0, parse: 0, write: 0 },
  };
}

describe("slowStart", () => {
  test("from opening the vault to ready, over three seconds", () => {
    expect(slowStart(ready(4500, 1000, 3), 300)).toBe(4200);
    expect(slowStart(ready(3000, 1000, 3), 300)).toBeNull();
  });

  test("from the start of the app when the opening is not known", () => {
    expect(slowStart(ready(3500, 1000, 3), null)).toBe(3500);
  });

  test("not after a scan that indexed most of the notes anew", () => {
    expect(slowStart(ready(20_000, 1000, 1000), 300)).toBeNull();
    expect(slowStart(ready(20_000, 1000, 501), 300)).toBeNull();
    expect(slowStart(ready(20_000, 1000, 500), 300)).toBe(19_700);
  });
});
