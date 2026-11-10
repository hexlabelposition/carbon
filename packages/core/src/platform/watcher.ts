export interface Watcher {
  /**
   * Watches `dir` recursively. Events are raw: the vault debounces and
   * deduplicates them. Resolves to a function that stops watching.
   */
  watch(dir: string, onEvent: (event: FsEvent) => void): Promise<() => void>;
}

export type FsEventKind = "created" | "modified" | "removed";

export interface FsEvent {
  kind: FsEventKind;
  /** Absolute path, `/` separated. */
  path: string;
}
