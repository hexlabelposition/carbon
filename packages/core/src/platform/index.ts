import type { FileSystem } from "./file-system";
import type { IndexStore } from "./index-store";
import type { Trash } from "./trash";
import type { Watcher } from "./watcher";

export type {
  Entry,
  EntryKind,
  FileSystem,
  RemoveOptions,
  Stat,
} from "./file-system";
export type { IndexStore } from "./index-store";
export type { Trash } from "./trash";
export type { FsEvent, FsEventKind, Watcher } from "./watcher";

/** Everything the core needs from the outside world. */
export interface Platform {
  fs: FileSystem;
  watcher: Watcher;
  index: IndexStore;
  trash: Trash;
}
