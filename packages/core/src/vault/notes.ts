import type { NotePath } from "../types";
import {
  expectFree,
  expectKind,
  moveEntry,
  type VaultContext,
} from "./entries";
import { parentOf, resolveInVault, resolveNewInVault } from "./path";

/**
 * Notes of a vault. Paths are relative to the vault root. The same methods
 * work for other files in the vault, such as images.
 */
export class Notes {
  constructor(private readonly context: VaultContext) {}

  /** Reads the text of a note. */
  async read(path: NotePath): Promise<string> {
    const { root, fs } = this.context;
    return fs.readText(resolveInVault(root, path));
  }

  /**
   * Replaces the text of a note, or creates the note if it does not exist.
   * The write is atomic: after a crash the file holds either the old text or
   * the new one, never a part of it. The folder must already exist.
   */
  async write(path: NotePath, content: string): Promise<void> {
    const { root, fs } = this.context;
    await fs.writeTextAtomic(resolveInVault(root, path), content);
  }

  /**
   * Creates a new note, with its folders if they are missing. Rejects if
   * something already exists at `path`.
   */
  async create(path: NotePath, content = ""): Promise<void> {
    const { root, fs } = this.context;
    const target = resolveNewInVault(root, path);
    await expectFree(this.context, path);
    await fs.mkdir(parentOf(target));
    await fs.writeTextAtomic(target, content);
  }

  /**
   * Renames a note or moves it to another folder. Rejects if the target is
   * taken or its folder does not exist. Links in other notes are not
   * updated yet (C-209).
   */
  async rename(from: NotePath, to: NotePath): Promise<void> {
    await moveEntry(this.context, from, to, "file");
  }

  /** Deletes a note for good. Moving to the system trash comes in C-106. */
  async remove(path: NotePath): Promise<void> {
    const { root, fs } = this.context;
    await expectKind(this.context, path, "file");
    await fs.remove(resolveInVault(root, path));
  }
}
