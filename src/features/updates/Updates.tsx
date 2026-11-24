import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCommands } from "../commands/commands";
import { AppDialog } from "../dialogs/AppDialog";
import { useAnyDialogOpen } from "../dialogs/dialog-count";
import { openDialog, useDialog } from "../dialogs/open-dialog";
import { errorText } from "../i18n/error-text";
import { useT } from "../i18n/i18n";
import { log } from "../log/log";
import {
  checkAtStartPreference,
  getCheckState,
  runBeforeUpdate,
  setCheckState,
  setUpdateActions,
  useCheckState,
  type AvailableUpdate,
  type CheckState,
  type Updater,
} from "./update-state";

/** Installing, once asked: it goes on to the end or fails. */
type InstallStep =
  | { kind: "installing"; part: number | null }
  | { kind: "restarting" }
  | { kind: "failed"; message: string; update: AvailableUpdate };

const button =
  "h-7 rounded-md border border-line-strong bg-panel px-3 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong";
const primary =
  "h-7 rounded-md bg-solid px-3 font-medium text-on-solid outline-none focus-visible:ring-2 focus-visible:ring-line-strong";

/**
 * Updates of the app (C-607, ADR-034). At start it looks for a newer
 * version, unless turned off in the settings, and if there is one asks
 * whether to install it, once no other dialog is open. The settings look
 * at any time and show what was found in their row; "Check for updates"
 * in the palette shows it in the dialog. Installing writes the unsaved
 * edits first (`useBeforeUpdate`), then starts the app again. Mount it
 * once, inside the commands provider. A dev build (`dev`) is not
 * installed: it looks only when asked and installs nothing.
 */
export function Updates({
  updater,
  dev = false,
}: {
  updater: Updater;
  dev?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useDialog("update");
  const checkState = useCheckState();
  const [installStep, setInstallStep] = useState<InstallStep | null>(null);
  // Found at start: shown once no other dialog stands over the window.
  const [foundAtStart, setFoundAtStart] = useState(false);
  const shownAtStart = useRef(false);
  const anyDialogOpen = useAnyDialogOpen();
  // Installing cannot be stopped: a check meanwhile does nothing.
  const installing = useRef(false);

  // Once, at start, as the setting was read. Nobody asked, so a failure,
  // such as no network, is only logged.
  useEffect(() => {
    if (dev || !checkAtStartPreference.get()) return;
    let cancelled = false;
    updater.check().then(
      (update) => {
        if (cancelled || update === null) return;
        if (getCheckState().kind !== "idle") return;
        setCheckState({ kind: "available", update });
        setFoundAtStart(true);
      },
      (reason: unknown) => log.warn("Could not check for updates", reason),
    );
    return () => {
      cancelled = true;
    };
  }, [updater, dev]);

  useEffect(() => {
    if (!foundAtStart || anyDialogOpen || shownAtStart.current) return;
    shownAtStart.current = true;
    openDialog("update");
  }, [foundAtStart, anyDialogOpen]);

  /** Looks now; what it finds goes to the shared check state. */
  const check = useCallback(async () => {
    if (installing.current || getCheckState().kind === "checking") return;
    setCheckState({ kind: "checking" });
    try {
      const update = await updater.check();
      setCheckState(
        update === null ? { kind: "upToDate" } : { kind: "available", update },
      );
    } catch (reason) {
      setCheckState({ kind: "failed", message: errorText(reason) });
    }
  }, [updater]);

  useEffect(() => {
    setUpdateActions({
      check: () => void check(),
      showUpdate: () => openDialog("update"),
    });
    return () => setUpdateActions(null);
  }, [check]);

  useCommands(
    useMemo(
      () => [
        {
          id: "updates.check",
          title: t("updates.check"),
          run: () => {
            openDialog("update");
            void check();
          },
        },
      ],
      [t, check],
    ),
  );

  async function install(update: AvailableUpdate) {
    installing.current = true;
    setInstallStep({ kind: "installing", part: null });
    try {
      await runBeforeUpdate();
      await update.install((part) =>
        setInstallStep({ kind: "installing", part }),
      );
      setInstallStep({ kind: "restarting" });
      await updater.restart();
    } catch (reason) {
      installing.current = false;
      setInstallStep({ kind: "failed", message: errorText(reason), update });
    }
  }

  const busy =
    installStep?.kind === "installing" || installStep?.kind === "restarting";
  const hasContent = installStep !== null || checkState.kind !== "idle";

  return (
    <AppDialog
      open={open && hasContent}
      // Installing goes on to the end: there is nothing to close then.
      onClose={() => {
        if (!busy) setOpen(false);
      }}
      closeOnOutsidePress={!busy}
      aria-labelledby="update-title"
      className="fixed inset-0 m-auto h-fit w-full max-w-[min(480px,calc(100vw-32px))] rounded-lg border border-line bg-bg p-5 shadow-dialog"
    >
      {installStep !== null ? (
        <InstallView
          step={installStep}
          onInstall={(update) => void install(update)}
          onClose={() => setOpen(false)}
        />
      ) : (
        <CheckView
          state={checkState}
          dev={dev}
          onInstall={(update) => void install(update)}
          onClose={() => setOpen(false)}
        />
      )}
    </AppDialog>
  );
}

function Title({ children }: { children: string }) {
  return (
    <h2 id="update-title" className="text-h3 font-semibold">
      {children}
    </h2>
  );
}

function CloseRow({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div className="mt-5 flex justify-end">
      <button type="button" className={button} onClick={onClose}>
        {t("common.close")}
      </button>
    </div>
  );
}

/** What a look for a newer version found, or that it is looking. */
function CheckView({
  state,
  dev,
  onInstall,
  onClose,
}: {
  state: CheckState;
  dev: boolean;
  onInstall: (update: AvailableUpdate) => void;
  onClose: () => void;
}) {
  const t = useT();
  switch (state.kind) {
    case "idle":
      return null;
    case "checking":
      return (
        <>
          <Title>{t("updates.title")}</Title>
          <p className="mt-2 text-muted">{t("updates.checking")}</p>
          <CloseRow onClose={onClose} />
        </>
      );
    case "upToDate":
      return (
        <>
          <Title>{t("updates.title")}</Title>
          <p className="mt-2 text-muted">
            {t("updates.upToDate", { version: __CARBON_VERSION__ })}
          </p>
          <CloseRow onClose={onClose} />
        </>
      );
    case "failed":
      return (
        <>
          <Title>{t("updates.title")}</Title>
          <p className="mt-2 text-danger">
            {t("updates.failed", { reason: state.message })}
          </p>
          <CloseRow onClose={onClose} />
        </>
      );
    case "available": {
      const { update } = state;
      return (
        <>
          <Title>{t("updates.available", { version: update.version })}</Title>
          <p className="mt-2 text-muted">
            {t("updates.availableText", { current: __CARBON_VERSION__ })}
          </p>
          {update.notes !== "" && (
            <>
              <h3 className="mt-4 font-medium">{t("updates.notes")}</h3>
              <p className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-muted">
                {update.notes}
              </p>
            </>
          )}
          {dev ? (
            <>
              <p className="mt-4 text-small text-faint">
                {t("updates.devBuild")}
              </p>
              <CloseRow onClose={onClose} />
            </>
          ) : (
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className={button} onClick={onClose}>
                {t("updates.later")}
              </button>
              <button
                type="button"
                className={primary}
                onClick={() => onInstall(update)}
              >
                {t("updates.install")}
              </button>
            </div>
          )}
        </>
      );
    }
  }
}

/** Installing: the download, the restart, or why it failed. */
function InstallView({
  step,
  onInstall,
  onClose,
}: {
  step: InstallStep;
  onInstall: (update: AvailableUpdate) => void;
  onClose: () => void;
}) {
  const t = useT();
  switch (step.kind) {
    case "installing": {
      const percent = step.part === null ? null : Math.round(step.part * 100);
      return (
        <>
          <Title>{t("updates.title")}</Title>
          <p className="mt-2 text-muted">
            {percent === null
              ? t("updates.downloading")
              : t("updates.downloadingPart", { percent })}
          </p>
          <div
            role="progressbar"
            aria-label={t("updates.downloading")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
            className="mt-3 h-1 overflow-hidden rounded-full bg-raise"
          >
            <div
              className="h-full bg-solid transition-[width]"
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
        </>
      );
    }
    case "restarting":
      return (
        <>
          <Title>{t("updates.title")}</Title>
          <p className="mt-2 text-muted">{t("updates.restarting")}</p>
        </>
      );
    case "failed": {
      const { update } = step;
      return (
        <>
          <Title>{t("updates.title")}</Title>
          <p className="mt-2 text-danger">
            {t("updates.installFailed", { reason: step.message })}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className={button} onClick={onClose}>
              {t("common.close")}
            </button>
            <button
              type="button"
              className={primary}
              onClick={() => onInstall(update)}
            >
              {t("updates.install")}
            </button>
          </div>
        </>
      );
    }
  }
}
