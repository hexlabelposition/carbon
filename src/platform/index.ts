// Tauri implementations of the @carbon/core platform interfaces.
// This folder is the only place in the app that imports `@tauri-apps/*`.

import type { Platform } from "@carbon/core";
import { tauriFileSystem } from "./file-system";
import { tauriIndexStore } from "./index-store";
import { tauriTrash } from "./trash";
import { tauriWatcher } from "./watcher";

export { pickVaultFolder } from "./dialog";
export { openDatabase, type Database } from "./sql";

export const tauriPlatform: Platform = {
  fs: tauriFileSystem,
  watcher: tauriWatcher,
  index: tauriIndexStore,
  trash: tauriTrash,
};
