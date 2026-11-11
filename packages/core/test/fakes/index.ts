import type { Platform } from "../../src/index";
import { MemoryFileSystem } from "./memory-file-system";
import { MemoryIndexStore } from "./memory-index-store";
import { MemoryTrash } from "./memory-trash";
import { MemoryWatcher } from "./memory-watcher";

export { MemoryFileSystem, MemoryIndexStore, MemoryTrash, MemoryWatcher };

/** A `Platform` whose parts keep their concrete types, for test helpers. */
export interface MemoryPlatform extends Platform {
  fs: MemoryFileSystem;
  watcher: MemoryWatcher;
  index: MemoryIndexStore;
  trash: MemoryTrash;
}

/** Builds an in-memory platform seeded with a `path -> content` map. */
export function createMemoryPlatform(
  files: Record<string, string> = {},
): MemoryPlatform {
  const fs = new MemoryFileSystem(files);
  return {
    fs,
    watcher: new MemoryWatcher(),
    index: new MemoryIndexStore(),
    trash: new MemoryTrash(fs),
  };
}
