import { appLogDir, homeDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { error, info, warn } from "@tauri-apps/plugin-log";

/**
 * The home folder of the user, to write as "~" in the log: the log is
 * sent along with a bug report, and the path of the home folder holds the
 * name of the user. Null when it cannot be found: lines are then written
 * as they are.
 */
const home: Promise<string | null> = homeDir().then(
  (path) => path.replace(/[\\/]+$/, ""),
  () => null,
);

/** `line` with the home folder written as "~", with either slash. */
export function withoutHome(line: string, home: string | null): string {
  if (home === null || home.length < 2) return line;
  const forward = home.replaceAll("\\", "/");
  let out = line.replaceAll(home, "~");
  if (forward !== home) out = out.replaceAll(forward, "~");
  return out;
}

/**
 * Writes a line to the log file of the app, through the `log` plugin: in
 * the log folder of the app, as `carbon.log` (C-606).
 */
export function writeLogLine(
  level: "error" | "warn" | "info",
  line: string,
): void {
  const write = level === "error" ? error : level === "warn" ? warn : info;
  // Lines keep their order: each waits for the same promise. Not awaited:
  // a line that cannot be written is not worth a failure.
  home.then((path) => write(withoutHome(line, path))).catch(() => {});
}

/** Opens the log folder of the app in the file manager. */
export async function openLogFolder(): Promise<void> {
  await openPath(await appLogDir());
}
