import type { Platform } from "../../src/index";
import { MemoryFileSystem } from "./memory-file-system";
import { MemorySettingsStore } from "./memory-settings-store";
import { MemorySqlDatabases } from "./memory-sql";
import { MemoryTrash } from "./memory-trash";
import { MemoryWatcher } from "./memory-watcher";

export {
  MemoryFileSystem,
  MemorySettingsStore,
  MemorySqlDatabases,
  MemoryTrash,
  MemoryWatcher,
};

/** A `Platform` whose parts keep their concrete types, for test helpers. */
export interface MemoryPlatform extends Platform {
  fs: MemoryFileSystem;
  watcher: MemoryWatcher;
  sql: MemorySqlDatabases;
  trash: MemoryTrash;
  settings: MemorySettingsStore;
}

/** Builds an in-memory platform seeded with a `path -> content` map. */
export function createMemoryPlatform(
  files: Record<string, string> = {},
): MemoryPlatform {
  const fs = new MemoryFileSystem(files);
  return {
    fs,
    watcher: new MemoryWatcher(),
    sql: new MemorySqlDatabases(),
    trash: new MemoryTrash(fs),
    settings: new MemorySettingsStore(),
  };
}
