// Public API of @carbon/core. The UI imports only from here.

export { Vault } from "./vault/vault";
export type { Notes, VaultEvents } from "./vault/vault";

export type {
  Entry,
  EntryKind,
  FileSystem,
  FsEvent,
  FsEventKind,
  IndexStore,
  Platform,
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
