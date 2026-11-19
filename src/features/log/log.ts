/** How bad a line of the log is. */
export type LogLevel = "error" | "warn" | "info";

/** Where the lines go besides the console: the log file of the platform. */
export type LogSink = (level: LogLevel, line: string) => void;

let sink: LogSink | null = null;

/**
 * Sends the lines of the log to `next` from now on, such as the log file
 * of the app (C-606). The app sets it once at start; without it, as in a
 * dev preview, the lines go to the console only.
 */
export function setLogSink(next: LogSink | null): void {
  sink = next;
}

/** A failure as one line: its name and message, then where it came from. */
export function describe(reason: unknown): string {
  if (reason instanceof Error) {
    const stack = reason.stack ?? "";
    // Engines start the stack with the message, WebKit does not.
    const head = `${reason.name}: ${reason.message}`;
    const rest = stack.startsWith(head) ? stack.slice(head.length) : stack;
    const lines = rest.trim() === "" ? "" : `\n${rest.trim()}`;
    return `${head}${lines}`;
  }
  if (typeof reason === "string") return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

function write(level: LogLevel, message: string, reason?: unknown) {
  const line =
    reason === undefined ? message : `${message}: ${describe(reason)}`;
  if (level === "error") console.error(message, reason ?? "");
  else if (level === "warn") console.warn(message, reason ?? "");
  else console.info(message);
  try {
    sink?.(level, line);
  } catch {
    // The log must never be the thing that breaks.
  }
}

/**
 * The log of the app: what went wrong, with the failure that says why.
 * Lines go to the console and to the log file, in English, as the core's
 * messages (ADR-025).
 */
export const log = {
  error: (message: string, reason?: unknown) => write("error", message, reason),
  warn: (message: string, reason?: unknown) => write("warn", message, reason),
  info: (message: string) => write("info", message),
};
