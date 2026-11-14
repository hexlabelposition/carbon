// Public API of @carbon/core. The UI imports only from here.

export { AppSettings } from "./config/app-settings";
export type { RecentVault } from "./config/app-settings";

export { Vault } from "./vault/vault";
export { checkVaultName } from "./vault/path";
export type { IndexStatus, VaultEvents, VaultOptions } from "./vault/vault";
export type { VaultChange } from "./vault/watch";
export type { DeleteOptions } from "./vault/entries";
export type { Folders } from "./vault/folders";
export { WriteConflictError } from "./vault/notes";
export { attachmentLink, ATTACHMENTS_FOLDER } from "./vault/attachments";
export type { Attachments } from "./vault/attachments";
export { Autosave } from "./vault/autosave";
export type { AutosaveOptions, SaveState } from "./vault/autosave";
export type { Notes } from "./vault/notes";
export type { FileNode, FolderNode, TreeNode } from "./vault/tree";
export { contentHash } from "./util/hash";

export { parseFiles } from "./parser/parse-files";
export { markdownParser, parseNote } from "./parser/parse-note";
export { wikiLink } from "./parser/wiki-link";

export { IndexStore, SCHEMA_VERSION, indexFileName } from "./index/index-store";
export type { FollowedLink, Links } from "./links/links";
export { linksToFile } from "./links/resolve";
export type { LinkUpdate } from "./links/rename";
export type { IndexEntry, NoteStamp } from "./index/index-store";
export type { Search, SearchOptions } from "./search/search";

export type {
  Entry,
  EntryKind,
  FileSystem,
  FsEvent,
  FsEventKind,
  NoteFile,
  NoteParser,
  ParsedFile,
  Platform,
  RemoveOptions,
  SettingsStore,
  SqlDatabase,
  SqlDatabases,
  SqlValue,
  Stat,
  Trash,
  Watcher,
} from "./platform";

export type {
  Backlink,
  Heading,
  Link,
  NotePath,
  OutgoingLink,
  ParsedNote,
  SearchHit,
  TextRange,
  UnresolvedTarget,
} from "./types";
