import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCommands } from "../commands/commands";
import { AppDialog, useAnyDialogOpen } from "../dialogs/AppDialog";
import { openDialog, useDialog } from "../dialogs/open-dialog";
import { errorText } from "../i18n/error-text";
import { useT } from "../i18n/i18n";
import { log } from "../log/log";
import {
  checkAtStartPreference,
  runBeforeUpdate,
  setCheckByHand,
  type AvailableUpdate,
  type Updater,
} from "./updates";

/** Where the dialog is: what it shows and which buttons it has. */
type Step =
  | { kind: "checking" }
  | { kind: "upToDate" }
  | { kind: "available"; update: AvailableUpdate }
  | { kind: "installing"; part: number | null }
  | { kind: "restarting" }
  | { kind: "failed"; message: string; update: AvailableUpdate | null };

const button =
  "h-7 rounded-md border border-line-strong bg-panel px-3 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong";
const primary =
  "h-7 rounded-md bg-solid px-3 font-medium text-on-solid outline-none focus-visible:ring-2 focus-visible:ring-line-strong";

/**
 * Updates of the app (C-607, ADR-034). At start it looks for a newer
 * version, unless turned off in the settings, and if there is one asks
 * whether to install it, once no other dialog is open. "Check for
 * updates", in the palette and the settings, looks at any time and says
 * what it found. Installing writes the unsaved edits first
 * (`useBeforeUpdate`), then starts the app again. Mount it once, inside
 * the commands provider; a dev build leaves it out.
 */
export function Updates({ updater }: { updater: Updater }) {
  const t = useT();
  const [open, setOpen] = useDialog("update");
  const [step, setStep] = useState<Step | null>(null);
  // Found at start: shown once no other dialog stands over the window.
  const [foundAtStart, setFoundAtStart] = useState(false);
  const shownAtStart = useRef(false);
  const anyDialogOpen = useAnyDialogOpen();
  // Installing cannot be stopped: a check meanwhile only shows it.
  const installing = useRef(false);

  // Once, at start, as the setting was read. Nobody asked, so a failure,
  // such as no network, is only logged.
  useEffect(() => {
    if (!checkAtStartPreference.get()) return;
    let cancelled = false;
    updater.check().then(
      (update) => {
        if (cancelled || update === null || installing.current) return;
        setStep({ kind: "available", update });
        setFoundAtStart(true);
      },
      (reason: unknown) => log.warn("Could not check for updates", reason),
    );
    return () => {
      cancelled = true;
    };
  }, [updater]);

  useEffect(() => {
    if (!foundAtStart || anyDialogOpen || shownAtStart.current) return;
    shownAtStart.current = true;
    openDialog("update");
  }, [foundAtStart, anyDialogOpen]);

  /** Looks now, asked from the palette or the settings, and says so. */
  const check = useCallback(async () => {
    openDialog("update");
    if (installing.current) return;
    setStep({ kind: "checking" });
    try {
      const update = await updater.check();
      if (installing.current) return;
      setStep(
        update === null ? { kind: "upToDate" } : { kind: "available", update },
      );
    } catch (reason) {
      setStep({ kind: "failed", message: errorText(reason), update: null });
    }
  }, [updater]);

  useEffect(() => {
    setCheckByHand(() => void check());
    return () => setCheckByHand(null);
  }, [check]);

  useCommands(
    useMemo(
      () => [
        {
          id: "updates.check",
          title: t("updates.check"),
          run: () => void check(),
        },
      ],
      [t, check],
    ),
  );

  async function install(update: AvailableUpdate) {
    installing.current = true;
    setStep({ kind: "installing", part: null });
    try {
      await runBeforeUpdate();
      await update.install((part) => setStep({ kind: "installing", part }));
      setStep({ kind: "restarting" });
      await updater.restart();
    } catch (reason) {
      installing.current = false;
      setStep({ kind: "failed", message: errorText(reason), update });
    }
  }

  const busy = step?.kind === "installing" || step?.kind === "restarting";

  return (
    <AppDialog
      open={open && step !== null}
      // Installing goes on to the end: there is nothing to close then.
      onClose={() => {
        if (!busy) setOpen(false);
      }}
      closeOnOutsidePress={!busy}
      aria-labelledby="update-title"
      className="fixed inset-0 m-auto h-fit w-full max-w-[min(480px,calc(100vw-32px))] rounded-lg border border-line bg-bg p-5 shadow-dialog"
    >
      {step !== null && (
        <UpdateStep
          step={step}
          onInstall={(update) => void install(update)}
          onClose={() => setOpen(false)}
        />
      )}
    </AppDialog>
  );
}

function UpdateStep({
  step,
  onInstall,
  onClose,
}: {
  step: Step;
  onInstall: (update: AvailableUpdate) => void;
  onClose: () => void;
}) {
  const t = useT();
  const title = (text: string) => (
    <h2 id="update-title" className="text-h3 font-semibold">
      {text}
    </h2>
  );
  const closeButton = (
    <div className="mt-5 flex justify-end">
      <button type="button" className={button} onClick={onClose}>
        {t("common.close")}
      </button>
    </div>
  );

  switch (step.kind) {
    case "checking":
      return (
        <>
          {title(t("updates.title"))}
          <p className="mt-2 text-muted">{t("updates.checking")}</p>
          {closeButton}
        </>
      );
    case "upToDate":
      return (
        <>
          {title(t("updates.title"))}
          <p className="mt-2 text-muted">
            {t("updates.upToDate", { version: __CARBON_VERSION__ })}
          </p>
          {closeButton}
        </>
      );
    case "available":
      return (
        <>
          {title(t("updates.available", { version: step.update.version }))}
          <p className="mt-2 text-muted">
            {t("updates.availableText", { current: __CARBON_VERSION__ })}
          </p>
          {step.update.notes !== "" && (
            <>
              <h3 className="mt-4 font-medium">{t("updates.notes")}</h3>
              <p className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-muted">
                {step.update.notes}
              </p>
            </>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className={button} onClick={onClose}>
              {t("updates.later")}
            </button>
            <button
              type="button"
              className={primary}
              onClick={() => onInstall(step.update)}
            >
              {t("updates.install")}
            </button>
          </div>
        </>
      );
    case "installing":
      return (
        <>
          {title(t("updates.title"))}
          <p className="mt-2 text-muted">
            {step.part === null
              ? t("updates.downloading")
              : t("updates.downloadingPart", {
                  percent: Math.round(step.part * 100),
                })}
          </p>
          <div
            role="progressbar"
            aria-label={t("updates.downloading")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              step.part === null ? undefined : Math.round(step.part * 100)
            }
            className="mt-3 h-1 overflow-hidden rounded-full bg-raise"
          >
            <div
              className="h-full bg-solid transition-[width]"
              style={{ width: `${(step.part ?? 0) * 100}%` }}
            />
          </div>
        </>
      );
    case "restarting":
      return (
        <>
          {title(t("updates.title"))}
          <p className="mt-2 text-muted">{t("updates.restarting")}</p>
        </>
      );
    case "failed": {
      const { update } = step;
      return (
        <>
          {title(t("updates.title"))}
          <p className="mt-2 text-danger">
            {t(update === null ? "updates.failed" : "updates.installFailed", {
              reason: step.message,
            })}
          </p>
          {update === null ? (
            closeButton
          ) : (
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
          )}
        </>
      );
    }
  }
}
