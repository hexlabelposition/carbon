import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "../i18n/i18n";
import { log } from "../log/log";

interface Props {
  /** Opens the folder with the log file, where the failure was written. */
  openLogFolder?: () => Promise<void>;
  children: ReactNode;
}

/**
 * Catches a failure while the interface is drawn, so the window does not
 * go blank: writes it to the log and shows what can be done instead
 * (C-606). Failures in event handlers and promises do not reach it; the
 * handlers of `catchUnhandled` (catch-unhandled.ts) log those.
 */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    log.error(
      `The interface failed${info.componentStack ?? ""}`.trimEnd(),
      error,
    );
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <Crashed openLogFolder={this.props.openLogFolder} />;
  }
}

function Crashed({ openLogFolder }: { openLogFolder?: () => Promise<void> }) {
  const t = useT();
  return (
    <div
      role="alert"
      className="flex h-dvh items-center justify-center bg-bg px-8 text-ui text-fg select-none"
    >
      <div className="flex max-w-100 flex-col gap-3">
        <h1 className="text-h3 font-semibold">{t("crash.title")}</h1>
        <p className="text-muted">{t("crash.body")}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            className="h-7 rounded-md bg-solid px-4 font-medium text-on-solid outline-none focus-visible:ring-1 focus-visible:ring-line-strong"
            onClick={() => window.location.reload()}
          >
            {t("crash.reload")}
          </button>
          {openLogFolder !== undefined && (
            <button
              type="button"
              className="h-7 rounded-md border border-line-strong bg-panel px-4 outline-none hover:bg-raise focus-visible:ring-1 focus-visible:ring-line-strong"
              onClick={() => {
                openLogFolder().catch((reason: unknown) =>
                  log.error("Could not open the log folder", reason),
                );
              }}
            >
              {t("logs.open")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
