import {
  deleteEntry,
  expectFree,
  makeFolders,
  moveEntry,
  type DeleteOptions,
  type VaultContext,
} from "./entries";
import { resolveNewInVault } from "./path";

/** Folders of a vault. Paths are relative to the vault root. */
export class Folders {
  constructor(private readonly context: VaultContext) {}

  /**
   * Creates a folder, with its parents if they are missing. Rejects if
   * something already exists at `path`.
   */
  async create(path: string): Promise<void> {
    const target = resolveNewInVault(this.context.root, path);
    await expectFree(this.context, path);
    await makeFolders(this.context, target);
  }

  /**
   * Renames a folder or moves it into another one, with everything inside.
   * Rejects if the target is taken, its parent does not exist, or the target
   * is inside the folder itself. Links are not updated yet (C-209).
   */
  async rename(from: string, to: string): Promise<void> {
    await moveEntry(this.context, from, to, "dir");
  }

  /**
   * Deletes a folder and everything inside it: moves it to the system
   * trash, or deletes it for good with `permanent`. Rejects if the trash is
   * not available.
   */
  async remove(path: string, options?: DeleteOptions): Promise<void> {
    await deleteEntry(this.context, path, "dir", options);
  }
}
