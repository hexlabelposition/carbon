// Tauri implementations of the @carbon/core platform interfaces.
// This folder is the only place in the app that imports `@tauri-apps/*`.

import type { Platform } from "@carbon/core";
import { tauriFileSystem } from "./file-system";
import { tauriSettingsStore } from "./settings-store";
import { tauriSqlDatabases } from "./sql";
import { tauriTrash } from "./trash";
import { tauriWatcher } from "./watcher";

export { pickVaultFolder } from "./dialog";
export { openDatabase, type Database } from "./sql";

export const tauriPlatform: Platform = {
  fs: tauriFileSystem,
  watcher: tauriWatcher,
  sql: tauriSqlDatabases,
  trash: tauriTrash,
  settings: tauriSettingsStore,
};
