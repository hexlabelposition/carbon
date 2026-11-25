import { describe, expect, test } from "bun:test";
import type { IndexStatus } from "@carbon/core";
import { timing } from "../vault/timing";
import { startupLine, startupRows, startupText } from "./startup-report";

const ready: IndexStatus = {
  state: "ready",
  notes: 1234,
  indexed: 3,
  ms: 200,
  // Ready 920 ms after the start of the app.
  doneAt: performance.timeOrigin + 920,
  waits: { list: 50, read: 60, parse: 40, write: 10 },
};

describe("startup report", () => {
  test("a vault ready: the times, the notes and the parts of the scan", () => {
    timing.shownAt = 310;
    timing.openedAt = 370;
    expect(startupText(startupRows(ready))).toBe(
      [
        "Carbon startup (times from the start of the app)",
        "Window shown: 0.31 s",
        "Ready: 0.92 s",
        "Opened to ready: 0.55 s",
        "Notes: 1,234",
        "Indexed: 3",
        "Scan took: 0.20 s",
        "  list: 0.05 s",
        "  read: 0.06 s",
        "  parse: 0.04 s",
        "  write: 0.01 s",
      ].join("\n"),
    );
  });

  test("one line for the log, the parts of the scan in brackets", () => {
    timing.shownAt = 310;
    timing.openedAt = 370;
    expect(startupLine(startupRows(ready))).toBe(
      "Startup: window shown 0.31 s, ready 0.92 s, opened to ready 0.55 s, " +
        "notes 1,234, indexed 3, scan took 0.20 s " +
        "(list 0.05 s, read 0.06 s, parse 0.04 s, write 0.01 s)",
    );
  });

  test("no vault, a scan under way, a failed index", () => {
    timing.shownAt = null;
    expect(startupText(startupRows(null))).toContain("Vault: none open");
    expect(startupText(startupRows(null))).toContain("Window shown: …");
    expect(
      startupText(startupRows({ state: "scanning", done: 5, total: 9 })),
    ).toContain("Index: scanning, 5 of 9");
    expect(
      startupText(startupRows({ state: "scanning", done: 5, total: null })),
    ).toContain("Index: scanning, 5");
    expect(
      startupText(startupRows({ state: "failed", error: new Error("x") })),
    ).toContain("Index: failed");
  });
});
