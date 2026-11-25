import { Dialog } from "@base-ui/react/dialog";
import type { IndexStatus, Vault } from "@carbon/core";
import { useEffect, useId, useMemo } from "react";
import { useCommands } from "../commands/commands";
import { AppDialog } from "../dialogs/AppDialog";
import { useDialog } from "../dialogs/open-dialog";
import { useT } from "../i18n/i18n";
import { log } from "../log/log";
import { useIndexStatus } from "../vault/use-index-status";
import { useVaultSession } from "../vault/vault-session";
import { notify } from "../notifications/notifications";
import { timing } from "../vault/timing";
import { showStartup } from "./show-startup";
import { slowStart, slowStartNoticePreference } from "./slow-start";
import { CopyStartupButton, StartupTable } from "./StartupReport";
import { startupLine, startupRows } from "./startup-report";

/**
 * Once the startup scan of the vault is over, writes how the app started
 * to the log, so a bug report about a slow start has the times, and tells
 * of a slow start under the bell, unless that is turned off.
 */
function useReportStartup(status: IndexStatus): void {
  const ready = status.state === "ready" ? status : null;
  useEffect(() => {
    if (ready === null) return;
    log.info(startupLine(startupRows(ready)));
    const took = slowStart(ready, timing.openedAt);
    if (took === null || !slowStartNoticePreference.get()) return;
    notify({
      id: "startup.slow",
      title: "startup.slowTitle",
      text: "startup.slowText",
      // To the tenth of a second, in the format of the language.
      params: { seconds: Math.round(took / 100) / 10 },
      action: { label: "startup.details", run: showStartup },
    });
  }, [ready]);
}

/**
 * How the open vault started: writes it to the log once it is ready, and
 * shows it in a dialog that the settings and the command palette open.
 * Mount it once per open vault.
 */
export function StartupHost({ vault }: { vault: Vault }) {
  const t = useT();
  const status = useIndexStatus(vault);
  const [open, setOpen] = useDialog("startup");
  useReportStartup(status);

  useCommands(
    useMemo(
      () => [
        { id: "startup.show", title: t("startup.command"), run: showStartup },
      ],
      [t],
    ),
  );

  return (
    <StartupDialog open={open} onClose={() => setOpen(false)} status={status} />
  );
}

/**
 * How the vault started over the settings, from their Help section: a
 * dialog in the settings dialog, as the question before a reset, so the
 * settings stay open below it. Nothing while no vault is open.
 */
export function StartupOverSettings({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { vault } = useVaultSession();
  if (vault === null) return null;
  return (
    <VaultStartupDialog
      vault={vault}
      open={open}
      onClose={onClose}
      backdrop="bg-backdrop/40"
    />
  );
}

function VaultStartupDialog({
  vault,
  ...props
}: Omit<StartupDialogProps, "status"> & { vault: Vault }) {
  return <StartupDialog {...props} status={useIndexStatus(vault)} />;
}

interface StartupDialogProps {
  open: boolean;
  onClose: () => void;
  status: IndexStatus;
  /** The backdrop's classes, lighter over another dialog (`AppDialog`). */
  backdrop?: string;
}

/** The report on how the vault started, with "Copy", in a dialog. */
function StartupDialog({
  open,
  onClose,
  status,
  backdrop,
}: StartupDialogProps) {
  const t = useT();
  const id = useId();
  const rows = startupRows(status);
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      backdrop={backdrop}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      className="fixed inset-0 m-auto flex h-fit max-h-[calc(100vh-96px)] w-full max-w-[min(400px,calc(100vw-32px))] flex-col gap-3 overflow-auto rounded-lg border border-line bg-bg p-4 shadow-dialog"
    >
      <div className="flex items-center justify-between gap-2">
        <Dialog.Title id={`${id}-title`} className="font-semibold">
          {t("startup.title")}
        </Dialog.Title>
        <Dialog.Close
          aria-label={t("common.close")}
          className="flex size-7 items-center justify-center rounded-md text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </Dialog.Close>
      </div>
      <p id={`${id}-text`} className="text-muted">
        {t("startup.text")}
      </p>
      <StartupTable rows={rows} />
      <div className="flex justify-end">
        <CopyStartupButton
          rows={rows}
          className="flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-panel px-3 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong"
        />
      </div>
    </AppDialog>
  );
}
