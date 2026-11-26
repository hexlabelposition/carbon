// Public API of @carbon/core. The UI imports only from here.

export { AppSettings } from "./config/app-settings";
export type { RecentVault } from "./config/app-settings";

export { Vault } from "./vault/vault";
export { VaultError } from "./errors";
export type { VaultErrorCode } from "./errors";
export { checkVaultName, DRAFTS_FOLDER, TRASH_FOLDER } from "./vault/path";
export type { DiscardOptions, TrashItem, VaultTrash } from "./vault/trash";
export type { Bookmarks } from "./vault/bookmarks";
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
export { hashtag, isTagLabel } from "./parser/hashtag";
export { blockId, isBlockId } from "./parser/block-id";
export {
  asFragment,
  fragmentRange,
  newBlockId,
  noteBlocks,
  withBlockId,
} from "./parser/blocks";
export type { FragmentRange, NoteBlock } from "./parser/blocks";
export { readFrontmatter } from "./parser/frontmatter";
export type { FrontmatterEntry } from "./parser/frontmatter";
export { editFrontmatter, propertyValue } from "./parser/frontmatter-edit";
export type { PropertyEdit, TextChange } from "./parser/frontmatter-edit";

export { IndexStore, SCHEMA_VERSION, indexFileName } from "./index/index-store";
export type { FollowedLink, Links } from "./links/links";
export { LOCAL_GRAPH_DEPTH } from "./links/graph";
export type { GlobalGraphOptions, Graph, GraphOptions } from "./links/graph";
export { linksToFile } from "./links/resolve";
export type { LinkUpdate } from "./links/rename";
export type { IndexEntry, NoteStamp } from "./index/index-store";
export type { ScanWaits } from "./index/scan";
export type { Search, SearchOptions, TitleOptions } from "./search/search";
export type { TitleHit } from "./search/titles";
export { tagTree } from "./tags/tags";
export type { TagNode, TagRename, Tags } from "./tags/tags";

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
  SqlStatement,
  SqlValue,
  NoteStat,
  Stat,
  Trash,
  Watcher,
} from "./platform";

export type {
  Backlink,
  GraphEdge,
  GraphNode,
  Heading,
  Link,
  Mention,
  NoteAlias,
  NoteGraph,
  NoteMetadata,
  NotePath,
  OutgoingLink,
  ParsedNote,
  SearchHit,
  TagCount,
  TextRange,
  UnresolvedTarget,
} from "./types";
