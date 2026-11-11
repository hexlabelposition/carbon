import {
  expectFree,
  expectKind,
  moveEntry,
  type VaultContext,
} from "./entries";
import { resolveInVault, resolveNewInVault } from "./path";

/** Folders of a vault. Paths are relative to the vault root. */
export class Folders {
  constructor(private readonly context: VaultContext) {}

  /**
   * Creates a folder, with its parents if they are missing. Rejects if
   * something already exists at `path`.
   */
  async create(path: string): Promise<void> {
    const { root, fs } = this.context;
    const target = resolveNewInVault(root, path);
    await expectFree(this.context, path);
    await fs.mkdir(target);
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
   * Deletes a folder and everything inside it for good. Moving to the
   * system trash comes in C-106.
   */
  async remove(path: string): Promise<void> {
    const { root, fs } = this.context;
    await expectKind(this.context, path, "dir");
    await fs.remove(resolveInVault(root, path), { recursive: true });
  }
}
