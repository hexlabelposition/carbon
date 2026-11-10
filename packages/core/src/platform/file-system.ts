/**
 * File access. Paths are absolute and use `/` as the separator on every
 * platform; an adapter converts them if its backend needs something else.
 */
export interface FileSystem {
  readText(path: string): Promise<string>;
  /** Writes to a temp file, then renames it over the target. */
  writeTextAtomic(path: string, content: string): Promise<void>;
  /** Direct children of `dir`, not recursive. */
  list(dir: string): Promise<Entry[]>;
  stat(path: string): Promise<Stat>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
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
