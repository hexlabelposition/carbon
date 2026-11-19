import { Dialog } from "@base-ui/react/dialog";
import type { IndexStatus, Vault } from "@carbon/core";
import { useEffect, useState, type ReactNode } from "react";
import { AppDialog } from "../features/dialogs/AppDialog";
import { useDialog } from "../features/dialogs/open-dialog";
import { LANGUAGE_SETTINGS, languagePreference } from "../features/i18n/i18n";
import { THEMES, themePreference } from "../features/theme/use-theme";
import {
  readySinceStart,
  seconds,
  useLogIndexTiming,
} from "../features/vault/IndexTiming";
import { timing } from "../features/vault/timing";
import { useIndexStatus } from "../features/vault/use-index-status";
import { useVaultSession } from "../features/vault/vault-session";
import { Tooltip } from "../features/ui/Tooltip";
import { log } from "../features/log/log";

/**
 * The dev tools at hand, mounted by the shell in dev builds only: an orange
 * bug in the top row, before the buttons of the panels, that opens a
 * dialog with how the app started, the theme, the language, the test vault
 * and the dev panel. It is there on the start screen too, where the
 * palette is not. Not translated.
 */
function DevButton({
  vault,
  panelOpen,
  onTogglePanel,
}: {
  vault: Vault | null;
  panelOpen: boolean;
  onTogglePanel(): void;
}) {
  const [open, setOpen] = useDialog("dev");
  const session = useVaultSession();
  const theme = themePreference.use();
  const language = languagePreference.use();

  function openTestVault() {
    setOpen(false);
    // The test vault is made afresh in place: not while it is open.
    session.close();
    void session.openPrepared(async () => {
      const { prepareTestVault } = await import("./test-vault");
      return prepareTestVault();
    });
  }

  return (
    <>
      <Tooltip label="Dev tools">
        <button
          type="button"
          aria-label="Dev tools"
          aria-pressed={open}
          // As tall as the top row, as the panel buttons beside it; only a
          // rounded square around the icon lights up.
          className="group flex h-full w-10 shrink-0 items-center justify-center text-dev outline-none"
          onClick={() => setOpen(!open)}
        >
          <span className="flex size-8 items-center justify-center rounded-md transition-colors duration-100 group-hover:bg-dev/15 group-focus-visible:ring-1 group-focus-visible:ring-dev/60 group-aria-pressed:bg-dev/15">
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* A bug: the head, the body with its seam, three legs a side. */}
              <path d="M6 5.5V5a2 2 0 0 1 4 0v.5" />
              <rect x="4.5" y="5.5" width="7" height="8.25" rx="3.5" />
              <path d="M8 8.25v3.5M4.5 9.75H2.25M13.75 9.75H11.5M4.75 7.5 2.75 6M11.25 7.5l2-1.5M4.75 12.25l-2 1.5M11.25 12.25l2 1.5" />
            </svg>
          </span>
        </button>
      </Tooltip>
      {/* Kept mounted: the timings log to the console once the vault is ready. */}
      <AppDialog
        open={open}
        keepMounted
        onClose={() => setOpen(false)}
        aria-label="Dev tools"
        className="fixed inset-0 m-auto flex h-fit max-h-[calc(100vh-96px)] w-90 max-w-[calc(100vw-32px)] flex-col gap-4 overflow-auto rounded-lg border border-line bg-bg p-4 text-small shadow-dialog select-none"
      >
        <div className="flex items-center justify-between">
          <Dialog.Title className="text-ui font-semibold text-dev">
            Dev tools
          </Dialog.Title>
          <Dialog.Close
            aria-label="Close"
            className="flex size-6 items-center justify-center rounded-md text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </Dialog.Close>
        </div>

        {vault === null ? (
          <Startup status={null} />
        ) : (
          <VaultStartup vault={vault} />
        )}

        <Section title="Theme">
          <Segmented
            value={theme}
            items={THEMES}
            onChange={themePreference.set}
          />
        </Section>

        <Section title="Language">
          <Segmented
            value={language}
            items={LANGUAGE_SETTINGS}
            onChange={languagePreference.set}
          />
        </Section>

        <div className="flex flex-col gap-1.5">
          <Tooltip
            label="A copy of fixtures/test-vault, made afresh each time"
            side="left"
          >
            <button
              type="button"
              className={action}
              disabled={session.opening}
              onClick={openTestVault}
            >
              Open test vault
            </button>
          </Tooltip>
          <button
            type="button"
            className={action}
            onClick={() => {
              setOpen(false);
              onTogglePanel();
            }}
          >
            {panelOpen ? "Close dev panel" : "Open dev panel"}
          </button>
          <Tooltip
            label="Loads the app page afresh, as F5 in a browser"
            side="left"
          >
            <button
              type="button"
              className={action}
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </Tooltip>
        </div>
      </AppDialog>
    </>
  );
}

/** The timings of the open vault; they log once its startup scan is over. */
function VaultStartup({ vault }: { vault: Vault }) {
  const status = useIndexStatus(vault);
  useLogIndexTiming(status);
  return <Startup status={status} />;
}

/** One line of the startup table; `sub` lines belong to the one above. */
interface StartupRow {
  label: string;
  value: string;
  sub?: boolean;
}

/** How the app started, as lines to show and to copy. */
function startupRows(status: IndexStatus | null): StartupRow[] {
  const rows: StartupRow[] = [
    {
      label: "Window shown",
      value: timing.shownAt === null ? "…" : seconds(timing.shownAt),
    },
  ];
  if (status === null) return [...rows, { label: "Vault", value: "none open" }];
  if (status.state === "failed") {
    return [...rows, { label: "Index", value: "failed" }];
  }
  if (status.state === "scanning") {
    const of = status.total === null ? "" : ` of ${status.total}`;
    return [
      ...rows,
      { label: "Index", value: `scanning, ${status.done}${of}` },
    ];
  }
  const sinceStart = readySinceStart(status.doneAt);
  const { list, read, parse, write } = status.waits;
  return [
    ...rows,
    { label: "Ready", value: seconds(sinceStart) },
    ...(timing.openedAt === null
      ? []
      : [
          {
            label: "Opened to ready",
            value: seconds(sinceStart - timing.openedAt),
          },
        ]),
    { label: "Notes", value: status.notes.toLocaleString("en") },
    { label: "Indexed", value: status.indexed.toLocaleString("en") },
    { label: "Scan took", value: seconds(status.ms) },
    { label: "list", value: seconds(list), sub: true },
    { label: "read", value: seconds(read), sub: true },
    { label: "parse", value: seconds(parse), sub: true },
    { label: "write", value: seconds(write), sub: true },
  ];
}

/** The lines as plain text, one "label: value" each. */
function startupText(rows: readonly StartupRow[]): string {
  return [
    "Carbon startup (times from the start of the page)",
    ...rows.map(
      ({ label, value, sub }) =>
        `${sub === true ? "  " : ""}${label}: ${value}`,
    ),
  ].join("\n");
}

/**
 * How the app started, as a table of times from the start of the page,
 * with a button that copies it as text.
 */
function Startup({ status }: { status: IndexStatus | null }) {
  const rows = startupRows(status);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  function copy() {
    navigator.clipboard.writeText(startupText(rows)).then(
      () => setCopied(true),
      (reason: unknown) => log.error("Could not copy the timings", reason),
    );
  }

  return (
    <Section
      title="Startup"
      action={
        <button
          type="button"
          className="flex h-6 items-center gap-1.5 rounded-md px-2 text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
          onClick={copy}
        >
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
          {copied ? "Copied" : "Copy"}
        </button>
      }
    >
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 rounded-md border border-line bg-panel px-3 py-2">
        {rows.map(({ label, value, sub }) => (
          <div key={label} className="contents">
            <dt
              className={
                sub === true ? "py-0.5 pl-3 text-faint" : "py-0.5 text-muted"
              }
            >
              {label}
            </dt>
            <dd
              className={`py-0.5 text-right font-mono tabular-nums ${
                sub === true ? "text-faint" : "text-fg"
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  /** A control at the right of the title. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex h-6 items-center justify-between">
        <h2 className="text-label font-semibold tracking-[0.06em] text-faint uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One of a few values, as buttons side by side. */
function Segmented<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: readonly T[];
  onChange(value: T): void;
}) {
  return (
    <div className="flex rounded-md border border-line-strong p-0.5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={item === value}
          className="h-6 flex-1 rounded-sm outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong aria-pressed:bg-selected aria-pressed:font-medium"
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

const action =
  "h-7 rounded-md border border-line-strong bg-panel px-2.5 text-left outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong disabled:text-faint";

export default DevButton;
