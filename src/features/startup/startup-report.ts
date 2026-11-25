import type { IndexStatus } from "@carbon/core";
import { readySinceStart, seconds } from "../vault/index-timing";
import { timing } from "../vault/timing";

/** The lines of the report on how the app started, in their order. */
export type StartupRowId =
  | "shown"
  | "vault"
  | "index"
  | "ready"
  | "openedToReady"
  | "notes"
  | "indexed"
  | "scan"
  | "list"
  | "read"
  | "parse"
  | "write";

/** What a line says: a time, a number of notes, or how the index is. */
export type StartupValue =
  | { kind: "time"; ms: number }
  | { kind: "count"; count: number }
  | { kind: "pending" }
  | { kind: "noVault" }
  | { kind: "failed" }
  | { kind: "scanning"; done: number; total: number | null };

/** One line of the report; `sub` lines are parts of the one above. */
export interface StartupRow {
  id: StartupRowId;
  value: StartupValue;
  sub?: boolean;
}

/**
 * How the app started, as lines: when the window showed, when the vault
 * was ready, as times from the start of the app, and how long the startup
 * scan took and where it waited (C-602). The settings, the dev tools and
 * the log show the same.
 */
export function startupRows(status: IndexStatus | null): StartupRow[] {
  const rows: StartupRow[] = [
    {
      id: "shown",
      value:
        timing.shownAt === null
          ? { kind: "pending" }
          : { kind: "time", ms: timing.shownAt },
    },
  ];
  if (status === null) {
    return [...rows, { id: "vault", value: { kind: "noVault" } }];
  }
  if (status.state === "failed") {
    return [...rows, { id: "index", value: { kind: "failed" } }];
  }
  if (status.state === "scanning") {
    return [
      ...rows,
      {
        id: "index",
        value: { kind: "scanning", done: status.done, total: status.total },
      },
    ];
  }
  const sinceStart = readySinceStart(status.doneAt);
  const { list, read, parse, write } = status.waits;
  const time = (ms: number): StartupValue => ({ kind: "time", ms });
  return [
    ...rows,
    { id: "ready", value: time(sinceStart) },
    ...(timing.openedAt === null
      ? []
      : [
          {
            id: "openedToReady" as const,
            value: time(sinceStart - timing.openedAt),
          },
        ]),
    { id: "notes", value: { kind: "count", count: status.notes } },
    { id: "indexed", value: { kind: "count", count: status.indexed } },
    { id: "scan", value: time(status.ms) },
    { id: "list", value: time(list), sub: true },
    { id: "read", value: time(read), sub: true },
    { id: "parse", value: time(parse), sub: true },
    { id: "write", value: time(write), sub: true },
  ];
}

/** The names of the lines in English: for the log and a bug report. */
const ENGLISH: Record<StartupRowId, string> = {
  shown: "Window shown",
  vault: "Vault",
  index: "Index",
  ready: "Ready",
  openedToReady: "Opened to ready",
  notes: "Notes",
  indexed: "Indexed",
  scan: "Scan took",
  list: "list",
  read: "read",
  parse: "parse",
  write: "write",
};

function englishValue(value: StartupValue): string {
  switch (value.kind) {
    case "time":
      return seconds(value.ms);
    case "count":
      return value.count.toLocaleString("en");
    case "pending":
      return "…";
    case "noVault":
      return "none open";
    case "failed":
      return "failed";
    case "scanning":
      return `scanning, ${value.done}${value.total === null ? "" : ` of ${value.total}`}`;
  }
}

/**
 * The report as plain text in English, one "name: value" a line: what
 * "Copy" puts on the clipboard, to paste into a bug report, as the
 * issues and the log are in English.
 */
export function startupText(rows: readonly StartupRow[]): string {
  return [
    "Carbon startup (times from the start of the app)",
    ...rows.map(
      ({ id, value, sub }) =>
        `${sub === true ? "  " : ""}${ENGLISH[id]}: ${englishValue(value)}`,
    ),
  ].join("\n");
}

/** The report on one line in English, for the log file. */
export function startupLine(rows: readonly StartupRow[]): string {
  const main = rows.filter((row) => row.sub !== true);
  const parts = rows.filter((row) => row.sub === true);
  const line = main
    .map(
      ({ id, value }) => `${ENGLISH[id].toLowerCase()} ${englishValue(value)}`,
    )
    .join(", ");
  if (parts.length === 0) return `Startup: ${line}`;
  const waits = parts
    .map(({ id, value }) => `${ENGLISH[id]} ${englishValue(value)}`)
    .join(", ");
  return `Startup: ${line} (${waits})`;
}
