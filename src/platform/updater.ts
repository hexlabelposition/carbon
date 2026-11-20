import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

/** A command rejects with a plain string; the app expects an `Error`. */
function asError(reason: unknown): Error {
  return reason instanceof Error
    ? reason
    : new Error(String(reason), { cause: reason });
}

/**
 * Updates of the app from its GitHub releases (C-607, ADR-034): the
 * `updater` plugin reads `latest.json` of the latest release, picks the
 * package of this install (AppImage, deb or the Windows installer) and
 * checks its signature against the key in `tauri.conf.json`.
 */
export const tauriUpdater = {
  /** The newer version, if there is one; rejects when it cannot tell. */
  async check() {
    const update = await check().catch((reason: unknown) => {
      throw asError(reason);
    });
    if (update === null) return null;
    return {
      version: update.version,
      notes: update.body?.trim() ?? "",
      /**
       * Downloads and installs it. `onProgress` gets the part downloaded,
       * from 0 to 1, or `null` while the size is unknown. On Windows the
       * installer closes the app; elsewhere `restart` starts the new one.
       * A deb asks the system for the password of an administrator.
       */
      async install(onProgress: (part: number | null) => void) {
        let total = 0;
        let done = 0;
        try {
          await update.downloadAndInstall((event) => {
            if (event.event === "Started") {
              total = event.data.contentLength ?? 0;
            } else if (event.event === "Progress") {
              done += event.data.chunkLength;
            }
            onProgress(total > 0 ? Math.min(done / total, 1) : null);
          });
        } catch (reason) {
          throw asError(reason);
        }
      },
    };
  },
  /** Starts the app again, as installed now. */
  restart: () => relaunch(),
};
