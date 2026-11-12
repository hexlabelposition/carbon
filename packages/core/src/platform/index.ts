import type { FileSystem } from "./file-system";
import type { SqlDatabases } from "./sql";
import type { NoteParser } from "./parser";
import type { SettingsStore } from "./settings-store";
import type { Trash } from "./trash";
import type { Watcher } from "./watcher";

export type {
  Entry,
  EntryKind,
  FileSystem,
  RemoveOptions,
  Stat,
} from "./file-system";
export type { SqlDatabase, SqlDatabases, SqlValue } from "./sql";
export type { NoteFile, NoteParser, ParsedFile } from "./parser";
export type { SettingsStore } from "./settings-store";
export type { Trash } from "./trash";
export type { FsEvent, FsEventKind, Watcher } from "./watcher";

/** Everything the core needs from the outside world. */
export interface Platform {
  fs: FileSystem;
  watcher: Watcher;
  sql: SqlDatabases;
  trash: Trash;
  settings: SettingsStore;
  /**
   * Parses notes away from the UI thread. Without one, the core parses
   * where it runs, which is fine for tests and small vaults.
   */
  parser?: NoteParser;
}
