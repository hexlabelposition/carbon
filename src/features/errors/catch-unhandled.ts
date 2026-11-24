import { log } from "../log/log";

/**
 * Writes to the log what no code caught: a failure in an event handler,
 * a timer or a promise nobody waits for.
 */
export function catchUnhandled(): void {
  window.addEventListener("error", (event) => {
    log.error("Uncaught", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    log.error("Unhandled rejection", event.reason);
  });
}
