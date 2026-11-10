import type { Platform } from "../../src/index";
import { MemoryFileSystem } from "./memory-file-system";
import { MemoryIndexStore } from "./memory-index-store";
import { MemoryWatcher } from "./memory-watcher";

export { MemoryFileSystem, MemoryIndexStore, MemoryWatcher };

/** A `Platform` whose parts keep their concrete types, for test helpers. */
export interface MemoryPlatform extends Platform {
  fs: MemoryFileSystem;
  watcher: MemoryWatcher;
  index: MemoryIndexStore;
}

/** Builds an in-memory platform seeded with a `path -> content` map. */
export function createMemoryPlatform(
  files: Record<string, string> = {},
): MemoryPlatform {
  return {
    fs: new MemoryFileSystem(files),
    watcher: new MemoryWatcher(),
    index: new MemoryIndexStore(),
  };
}
