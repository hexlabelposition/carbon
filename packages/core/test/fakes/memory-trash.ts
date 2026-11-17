import type { Trash } from "../../src/index";
import type { MemoryFileSystem } from "./memory-file-system";

/**
 * An in-memory `Trash`: what is trashed disappears from the file system and
 * its path is kept in `items`.
 */
export class MemoryTrash implements Trash {
  /** Absolute paths that were moved to the trash, oldest first. */
  readonly items: string[] = [];
  /** Test helper: set to false to play a drive that has no trash. */
  available = true;

  constructor(private readonly fs: MemoryFileSystem) {}

  async moveToTrash(path: string): Promise<void> {
    if (!this.available) throw new Error(`No trash for: ${path}`);
    await this.fs.remove(path, { recursive: true });
    this.items.push(path);
  }
}
