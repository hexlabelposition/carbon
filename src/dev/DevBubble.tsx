import { Popover } from "@base-ui/react/popover";
import type { Vault } from "@carbon/core";
import { useState, type ReactNode } from "react";
import { LANGUAGE_SETTINGS, languagePreference } from "../features/i18n/i18n";
import { THEMES, themePreference } from "../features/theme/use-theme";
import { IndexTiming, seconds } from "../features/vault/IndexTiming";
import { timing } from "../features/vault/timing";
import { useIndexStatus } from "../features/vault/use-index-status";
import { useVaultSession } from "../features/vault/vault-session";
import { Tooltip } from "../features/ui/Tooltip";

/**
 * The dev tools at hand, mounted by the shell in dev builds only: a round
 * button at the bottom right that opens how the app started, the theme,
 * the language, the test vault and the dev panel. It is there on the
 * start screen too, where the palette is not. Not translated.
 */
function DevBubble({
  vault,
  panelOpen,
  onTogglePanel,
}: {
  vault: Vault | null;
  panelOpen: boolean;
  onTogglePanel(): void;
}) {
  const [open, setOpen] = useState(false);
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
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Dev tools"
        className="fixed right-4 bottom-4 z-40 flex size-9 items-center justify-center rounded-full border border-line-strong bg-panel text-muted shadow-dialog outline-none select-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong data-popup-open:bg-raise data-popup-open:text-fg"
      >
        <svg
          viewBox="0 0 16 16"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {/* A bug: the head, the body with its seam, three legs a side. */}
          <path d="M6 5.5V5a2 2 0 0 1 4 0v.5" />
          <rect x="4.5" y="5.5" width="7" height="8.25" rx="3.5" />
          <path d="M8 8.25v3.5M4.5 9.75H2.25M13.75 9.75H11.5M4.75 7.5 2.75 6M11.25 7.5l2-1.5M4.75 12.25l-2 1.5M11.25 12.25l2 1.5" />
        </svg>
      </Popover.Trigger>
      {/* Kept mounted: the timings log to the console once the vault is ready. */}
      <Popover.Portal keepMounted>
        <Popover.Positioner
          side="top"
          align="end"
          sideOffset={8}
          className="z-40 outline-none"
        >
          <Popover.Popup className="flex w-80 flex-col gap-4 rounded-lg border border-line bg-bg p-3 text-small text-fg shadow-dialog outline-none select-none data-closed:hidden">
            <Section title="Startup">
              <div className="flex flex-col gap-1 font-mono text-faint">
                <p>
                  window shown{" "}
                  {timing.shownAt === null ? "…" : seconds(timing.shownAt)}{" "}
                  after start
                </p>
                {vault === null ? (
                  <p>no vault open</p>
                ) : (
                  <VaultTiming vault={vault} />
                )}
              </div>
            </Section>

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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The timings of the open vault, once its startup scan is over. */
function VaultTiming({ vault }: { vault: Vault }) {
  const status = useIndexStatus(vault);
  if (status.state === "ready") return <IndexTiming status={status} />;
  return <p>{status.state === "failed" ? "index failed" : "indexing…"}</p>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-label font-semibold tracking-[0.06em] text-faint uppercase">
        {title}
      </h2>
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

export default DevBubble;
