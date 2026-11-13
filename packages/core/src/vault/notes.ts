import type { LinkRewriter, LinkUpdate } from "../links/rename";
import type { NotePath } from "../types";
import { contentHash } from "../util/hash";
import {
  deleteEntry,
  expectFree,
  makeFolders,
  moveEntry,
  type DeleteOptions,
  type VaultContext,
} from "./entries";
import { parentOf, resolveInVault, resolveNewInVault } from "./path";

/**
 * A write was rejected because the note on disk is not the version the
 * caller started from: it was changed, deleted or created by someone else.
 */
export class WriteConflictError extends Error {
  constructor(readonly path: NotePath) {
    super(`Changed on disk since it was read: ${path}`);
    this.name = "WriteConflictError";
  }
}

/**
 * Notes of a vault. Paths are relative to the vault root. The same methods
 * work for other files in the vault, such as images.
 */
export class Notes {
  constructor(
    private readonly context: VaultContext,
    private readonly links: LinkRewriter,
  ) {}

  /** Reads the text of a note. */
  async read(path: NotePath): Promise<string> {
    const { root, fs } = this.context;
    return fs.readText(resolveInVault(root, path));
  }

  /**
   * Saves the text of a note, unless the note changed on disk since the
   * caller last saw it.
   *
   * `baseHash` is the `contentHash` of the text the caller started from: the
   * text it read, or the hash its previous `write` returned. `null` means the
   * caller expects no file at `path`, and the note is created; the folder
   * must already exist. If the disk holds something else, nothing is written
   * and the call rejects with a `WriteConflictError`.
   *
   * The write is atomic: after a crash the file holds either the old text or
   * the new one, never a part of it. Resolves with the hash of `content`,
   * the base for the next write.
   */
  async write(
    path: NotePath,
    content: string,
    baseHash: string | null,
  ): Promise<string> {
    const { root, fs, own } = this.context;
    const target = resolveInVault(root, path);
    const hash = contentHash(content);
    // Another program can still change the file between this check and the
    // rename below. The file system has no compare-and-swap, so that window
    // cannot be closed, only kept short.
    const onDisk = (await fs.exists(target))
      ? contentHash(await fs.readText(target))
      : null;
    if (onDisk !== baseHash) {
      // The disk already holds exactly this text, for example a sync tool
      // brought the same edit from another device. There is nothing to lose.
      if (onDisk === hash) return hash;
      throw new WriteConflictError(path);
    }
    await fs.writeTextAtomic(target, content);
    await own.wrote(target, onDisk !== null);
    return hash;
  }

  /**
   * Creates a new note, with its folders if they are missing. Rejects if
   * something already exists at `path`.
   */
  async create(path: NotePath, content = ""): Promise<void> {
    const { root, fs, own } = this.context;
    const target = resolveNewInVault(root, path);
    await expectFree(this.context, path);
    await makeFolders(this.context, parentOf(target));
    await fs.writeTextAtomic(target, content);
    await own.wrote(target);
  }

  /**
   * Renames a note or moves it to another folder, and rewrites the links
   * that pointed to it (see `LinkRewriter`). Rejects if the target is
   * taken or its folder does not exist. Waits for the index to catch up
   * first: the links are found through it.
   */
  async rename(from: NotePath, to: NotePath): Promise<LinkUpdate> {
    const rewrite = await this.links.prepare(from, to, "file");
    await moveEntry(this.context, from, to, "file");
    return rewrite.apply();
  }

  /**
   * Deletes a note: moves it to the system trash, or deletes it for good
   * with `permanent`. Rejects if the trash is not available.
   */
  async remove(path: NotePath, options?: DeleteOptions): Promise<void> {
    await deleteEntry(this.context, path, "file", options);
  }
}
