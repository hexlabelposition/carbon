/**
 * File access. Paths are absolute and use `/` as the separator on every
 * platform; an adapter converts them if its backend needs something else.
 */
export interface FileSystem {
  readText(path: string): Promise<string>;
  /** Writes to a temp file, then renames it over the target. */
  writeTextAtomic(path: string, content: string): Promise<void>;
  /** Reads a file as it is, for files that are not text: images. */
  readBytes(path: string): Promise<Uint8Array>;
  /** Like `writeTextAtomic`, for bytes. */
  writeBytesAtomic(path: string, bytes: Uint8Array): Promise<void>;
  /**
   * Copies a file from anywhere on the device to `target`, which must not
   * exist yet. For a file the user handed to the app from outside the
   * vault, by dropping it: `source` is the only path the core ever uses
   * that it did not build itself.
   */
  importFile(source: string, target: string): Promise<void>;
  /** Direct children of `dir`, not recursive. */
  list(dir: string): Promise<Entry[]>;
  /** Rejects if nothing exists at `path`. */
  stat(path: string): Promise<Stat>;
  exists(path: string): Promise<boolean>;
  /** Creates a folder and any missing parents. Does nothing if it exists. */
  mkdir(path: string): Promise<void>;
  /**
   * Moves a file or folder. What happens when `to` exists depends on the
   * platform, so the caller checks first.
   */
  rename(from: string, to: string): Promise<void>;
  /**
   * Deletes a file or folder for good. A folder with anything inside is
   * only deleted with `recursive`.
   */
  remove(path: string, options?: RemoveOptions): Promise<void>;
}

export interface RemoveOptions {
  recursive?: boolean;
}

export type EntryKind = "file" | "dir";

export interface Entry {
  /** File or folder name without the parent path. */
  name: string;
  kind: EntryKind;
}

export interface Stat {
  kind: EntryKind;
  /** Size in bytes. */
  size: number;
  /** Last modification time, milliseconds since the Unix epoch. */
  mtime: number;
}
