import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { catchUnhandled, ErrorBoundary } from "./features/errors/ErrorBoundary";
import { log, setLogSink } from "./features/log/log";
import { openLogFolder, writeLogLine } from "./platform";
import { insideTauri } from "./platform/runtime";
import { BrowserNotice } from "./shells/browser/BrowserNotice";
import "./styles/index.css";

const tauri = insideTauri();
if (tauri) {
  // Before anything else, so that even a failure at start is written.
  setLogSink(writeLogLine);
  catchUnhandled();
  log.info(`Carbon ${__CARBON_VERSION__} started`);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* In a plain web browser the app cannot start: it says so instead. */}
    {tauri ? (
      <ErrorBoundary openLogFolder={openLogFolder}>
        <App />
      </ErrorBoundary>
    ) : (
      <BrowserNotice />
    )}
  </React.StrictMode>,
);
