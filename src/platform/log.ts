import { appLogDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { error, info, warn } from "@tauri-apps/plugin-log";

/**
 * Writes a line to the log file of the app, through the `log` plugin: in
 * the log folder of the app, as `carbon.log` (C-606).
 */
export function writeLogLine(
  level: "error" | "warn" | "info",
  line: string,
): void {
  const write = level === "error" ? error : level === "warn" ? warn : info;
  // Not awaited: a line that cannot be written is not worth a failure.
  write(line).catch(() => {});
}

/** Opens the log folder of the app in the file manager. */
export async function openLogFolder(): Promise<void> {
  await openPath(await appLogDir());
}
