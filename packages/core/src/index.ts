// Public API of @carbon/core. The UI imports only from here.

export { AppSettings } from "./config/app-settings";
export type { RecentVault } from "./config/app-settings";

export { Vault } from "./vault/vault";
export { checkVaultName } from "./vault/path";
export type { VaultEvents, VaultOptions } from "./vault/vault";
export type { VaultChange } from "./vault/watch";
export type { DeleteOptions } from "./vault/entries";
export type { Folders } from "./vault/folders";
export { WriteConflictError } from "./vault/notes";
export { Autosave } from "./vault/autosave";
export type { AutosaveOptions, SaveState } from "./vault/autosave";
export type { Notes } from "./vault/notes";
export type { FileNode, FolderNode, TreeNode } from "./vault/tree";
export { contentHash } from "./util/hash";

export type {
  Entry,
  EntryKind,
  FileSystem,
  FsEvent,
  FsEventKind,
  IndexStore,
  Platform,
  RemoveOptions,
  SettingsStore,
  Stat,
  Trash,
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
