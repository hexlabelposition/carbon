import { useEffect, useState } from "react";
import { log } from "../log/log";
import { useLanguage, useT, type MessageKey } from "../i18n/i18n";
import {
  startupText,
  type StartupRow,
  type StartupRowId,
  type StartupValue,
} from "./startup-report";

const LABELS: Record<StartupRowId, MessageKey> = {
  shown: "startup.shown",
  vault: "startup.vault",
  index: "startup.index",
  ready: "startup.ready",
  openedToReady: "startup.openedToReady",
  notes: "startup.notes",
  indexed: "startup.indexed",
  scan: "startup.scan",
  list: "startup.list",
  read: "startup.read",
  parse: "startup.parse",
  write: "startup.write",
};

/** A value of the report in the language of the interface. */
function useValueText(): (value: StartupValue) => string {
  const t = useT();
  const language = useLanguage();
  const hundredths = new Intl.NumberFormat(language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (value) => {
    switch (value.kind) {
      case "time":
        return t("startup.seconds", {
          value: hundredths.format(value.ms / 1000),
        });
      case "count":
        return value.count.toLocaleString(language);
      case "pending":
        return "…";
      case "noVault":
        return t("startup.noVault");
      case "failed":
        return t("startup.failed");
      case "scanning":
        return value.total === null
          ? t("startup.scanningCount", { done: value.done })
          : t("startup.scanning", { done: value.done, total: value.total });
    }
  };
}

/**
 * The report on how the app started as a table: names at the left, times
 * at the right, the parts of the scan under it, fainter.
 */
export function StartupTable({ rows }: { rows: readonly StartupRow[] }) {
  const t = useT();
  const valueText = useValueText();
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 rounded-md border border-line bg-panel px-3 py-2">
      {rows.map(({ id, value, sub }) => (
        <div key={id} className="contents">
          <dt
            className={
              sub === true ? "py-0.5 pl-3 text-faint" : "py-0.5 text-muted"
            }
          >
            {t(LABELS[id])}
          </dt>
          <dd
            className={`py-0.5 text-right font-mono tabular-nums ${
              sub === true ? "text-faint" : "text-fg"
            }`}
          >
            {valueText(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Copies the report as text in English (`startupText`), to paste into a
 * bug report; says "Copied" for a moment after.
 */
export function CopyStartupButton({
  rows,
  className,
}: {
  rows: readonly StartupRow[];
  className: string;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  function copy() {
    navigator.clipboard.writeText(startupText(rows)).then(
      () => setCopied(true),
      (reason: unknown) =>
        log.error("Could not copy the startup times", reason),
    );
  }

  return (
    <button type="button" className={className} onClick={copy}>
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {copied ? (
          <path d="M3 8.5l3 3 7-7" />
        ) : (
          <>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
          </>
        )}
      </svg>
      {copied ? t("startup.copied") : t("startup.copy")}
    </button>
  );
}
