// Public API of @carbon/core. The UI imports only from here.

export { Vault } from "./vault/vault";
export type { VaultEvents, VaultOptions } from "./vault/vault";
export type { VaultChange } from "./vault/watch";
export type { Folders } from "./vault/folders";
export type { Notes } from "./vault/notes";
export type { FileNode, FolderNode, TreeNode } from "./vault/tree";

export type {
  Entry,
  EntryKind,
  FileSystem,
  FsEvent,
  FsEventKind,
  IndexStore,
  Platform,
  RemoveOptions,
  Stat,
  Watcher,
} from "./platform";

export type {
  Backlink,
  Heading,
  Link,
  NotePath,
  ParsedNote,
  SearchHit,
} from "./types";
