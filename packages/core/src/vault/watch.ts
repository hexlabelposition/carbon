import type {
  FileSystem,
  FsEvent,
  FsEventKind,
  Stat,
  Watcher,
} from "../platform";
import { mapPool } from "../util/pool";
import type { OwnChanges } from "./own-changes";

/** A change made to the vault by something other than the vault itself. */
export interface VaultChange {
  kind: "added" | "changed" | "removed";
  /** A note, another file or a folder. Relative to the vault root. */
  path: string;
}

export interface VaultWatchOptions {
  root: string;
  fs: FileSystem;
  watcher: Watcher;
  own: OwnChanges;
  /** How long the vault must be quiet before changes are reported. */
  delayMs: number;
  /** Called for every raw event, before the delay. */
  onActivity: () => void;
  onChange: (change: VaultChange) => void;
}

const STAT_CONCURRENCY = 32;

/**
 * Turns the raw, noisy events of the platform watcher into one event per
 * path. Events are collected until the vault has been quiet for `delayMs`,
 * then each path is checked on disk: what is reported is the state that was
 * found, not what the events claimed.
 */
export class VaultWatch {
  /** Absolute path to the kind of the first event seen for it. */
  private pending = new Map<string, FsEventKind>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unwatch: (() => void) | null = null;
  private stopped = false;

  constructor(private readonly options: VaultWatchOptions) {}

  async start(): Promise<void> {
    const { watcher, root } = this.options;
    const unwatch = await watcher.watch(root, (event) => this.onEvent(event));
    if (this.stopped) unwatch();
    else this.unwatch = unwatch;
  }

  stop(): void {
    this.stopped = true;
    this.unwatch?.();
    this.unwatch = null;
    clearTimeout(this.timer);
    this.pending.clear();
  }

  private onEvent(event: FsEvent): void {
    const { root, delayMs, onActivity } = this.options;
    if (this.stopped || !event.path.startsWith(`${root}/`)) return;
    const relative = event.path.slice(root.length + 1);
    // Hidden files and folders are not part of the vault. This also drops
    // the temp files of atomic writes.
    if (relative.split("/").some((s) => s.startsWith("."))) return;

    onActivity();
    // The first event tells whether the path existed before the burst.
    if (!this.pending.has(event.path)) this.pending.set(event.path, event.kind);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delayMs);
  }

  private async flush(): Promise<void> {
    const { root, fs, own, onChange } = this.options;
    const batch = [...this.pending].sort(([a], [b]) => (a < b ? -1 : 1));
    this.pending = new Map();

    const stats = await mapPool(batch, STAT_CONCURRENCY, ([path]) =>
      fs.stat(path).catch((): Stat | null => null),
    );
    if (this.stopped) return;

    batch.forEach(([path, first], i) => {
      const stat = stats[i];
      if (own.explains(path, stat)) return;
      const existed = first !== "created";
      let kind: VaultChange["kind"];
      if (stat === null) {
        // Created and deleted within one burst: nothing to report.
        if (!existed) return;
        kind = "removed";
      } else if (!existed) {
        kind = "added";
      } else {
        // A folder is "modified" whenever something inside it changes, and
        // that something reports itself.
        if (stat.kind === "dir") return;
        kind = "changed";
      }
      onChange({ kind, path: path.slice(root.length + 1) });
    });
  }
}
