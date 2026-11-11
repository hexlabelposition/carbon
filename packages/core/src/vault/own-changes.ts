import type { FileSystem, Stat } from "../platform";
import { parentOf } from "./path";

/**
 * Remembers what the vault itself last did to each path, so the watcher can
 * tell an echo of the vault's own work from a change made by someone else.
 *
 * The check compares the state on disk, not time: there is no window in
 * which an outside change could be mistaken for the vault's own.
 */
export class OwnChanges {
  private readonly states = new Map<string, Stat | "removed">();

  constructor(
    private readonly fs: FileSystem,
    /** Called after every change the vault makes. */
    private readonly onChange: () => void,
  ) {}

  /** The vault created, wrote or moved something to `path`. */
  async wrote(path: string): Promise<void> {
    this.states.set(path, await this.fs.stat(path));
    this.onChange();
  }

  /** The vault deleted `path` or moved it away. */
  removed(path: string): void {
    this.states.set(path, "removed");
    this.onChange();
  }

  /**
   * True if what is on disk now (`stat`, or `null` for nothing) is what the
   * vault itself left there.
   */
  explains(path: string, stat: Stat | null): boolean {
    if (stat === null) {
      // Deleting a folder also deletes everything inside it.
      for (let p = path; p !== ""; p = parentOf(p)) {
        if (this.states.get(p) === "removed") return true;
      }
      return false;
    }
    const own = this.states.get(path);
    if (own === undefined) return false;
    if (own === "removed") {
      // Someone else put it back. Forget the removal, or later deletions
      // inside it would look like the vault's own.
      this.states.delete(path);
      return false;
    }
    if (own.kind !== stat.kind) return false;
    // A folder's time changes whenever its contents do.
    return (
      own.kind === "dir" || (own.mtime === stat.mtime && own.size === stat.size)
    );
  }
}
