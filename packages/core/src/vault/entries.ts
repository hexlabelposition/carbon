import type { EntryKind, FileSystem, Trash } from "../platform";
import type { OwnChanges } from "./own-changes";
import {
  DRAFTS_FOLDER,
  isVaultPath,
  parentOf,
  resolveInVault,
  resolveNewInVault,
} from "./path";
import type { Favorites } from "./favorites";
import type { VaultTrash } from "./trash";

/** What the parts of a vault share: where it is and how to reach the disk. */
export interface VaultContext {
  /** Absolute path of the vault folder, `/` separated. */
  root: string;
  fs: FileSystem;
  /** Where deleted entries go (ADR-031). */
  trash: VaultTrash;
  /** The trash of the operating system, for `DeleteOptions.system`. */
  systemTrash: Trash;
  /** Kept right as entries move and go. */
  favorites: Favorites;
  /** Every change the vault makes is recorded here (see `OwnChanges`). */
  own: OwnChanges;
}

export interface DeleteOptions {
  /**
   * Delete for good instead of moving to the trash of the vault. Nothing
   * brings the note or folder back after that.
   */
  permanent?: boolean;
  /**
   * Move to the trash of the operating system instead of the one of the
   * vault. Rejects if it is not available; nothing is deleted then.
   */
  system?: boolean;
}

/** Rejects unless `path` exists and is of the given kind. */
export async function expectKind(
  { root, fs }: Pick<VaultContext, "root" | "fs">,
  path: string,
  kind: EntryKind,
): Promise<void> {
  const stat = await fs.stat(resolveInVault(root, path));
  if (stat.kind !== kind) {
    throw new Error(`Not a ${kind === "dir" ? "folder" : "file"}: ${path}`);
  }
}

/** Rejects if something already exists at `path`. */
export async function expectFree(
  { root, fs }: Pick<VaultContext, "root" | "fs">,
  path: string,
): Promise<void> {
  if (await fs.exists(resolveNewInVault(root, path))) {
    throw new Error(`Already exists: ${path}`);
  }
}

/** Creates the folder at the absolute path `dir` and any missing parents. */
export async function makeFolders(
  { root, fs, own }: Pick<VaultContext, "root" | "fs" | "own">,
  dir: string,
): Promise<void> {
  const missing: string[] = [];
  for (let d = dir; d !== root && !(await fs.exists(d)); d = parentOf(d)) {
    missing.push(d);
  }
  if (missing.length === 0) return;
  await fs.mkdir(dir);
  for (const created of missing) await own.wrote(created);
}

/**
 * Renames or moves a file or folder. Never overwrites: if the target is
 * taken, the move is rejected. The target folder must exist.
 */
export async function moveEntry(
  context: VaultContext,
  from: string,
  to: string,
  kind: EntryKind,
): Promise<void> {
  const { root, fs, own } = context;
  const source = resolveInVault(root, from);
  const target = resolveNewInVault(root, to);
  await expectKind(context, from, kind);
  if (source === target) return;
  if (kind === "dir" && target.startsWith(`${source}/`)) {
    throw new Error(`Cannot move a folder into itself: ${from}`);
  }
  // On a case-insensitive file system "note.md" and "Note.md" are the same
  // file, so a change of case alone must not count as a taken target.
  const caseOnly = source.toLowerCase() === target.toLowerCase();
  if (!caseOnly) await expectFree(context, to);
  await fs.rename(source, target);
  own.removed(source);
  await own.wrote(target);
  await context.favorites.moved(slashed(from), slashed(to));
}

/** A vault path with `/` separators only. */
function slashed(path: string): string {
  return path.replaceAll("\\", "/");
}

/**
 * Copies a file or folder, with everything inside, to `to`. Never
 * overwrites: if the target is taken, the copy is rejected. The target
 * folder must exist. Links in the copies are left as they are.
 */
export async function copyEntry(
  context: VaultContext,
  from: string,
  to: string,
  kind: EntryKind,
): Promise<void> {
  const { root } = context;
  const source = resolveInVault(root, from);
  const target = resolveNewInVault(root, to);
  await expectKind(context, from, kind);
  if (
    kind === "dir" &&
    (target === source || target.startsWith(`${source}/`))
  ) {
    throw new Error(`Cannot copy a folder into itself: ${from}`);
  }
  await expectFree(context, to);
  await copyTree(context, source, target, kind);
}

/** Copies the absolute path `source` to the free `target`, folders whole. */
async function copyTree(
  context: VaultContext,
  source: string,
  target: string,
  kind: EntryKind,
): Promise<void> {
  const { fs, own } = context;
  if (kind === "file") {
    await fs.writeBytesAtomic(target, await fs.readBytes(source));
    await own.wrote(target);
    return;
  }
  await fs.mkdir(target);
  await own.wrote(target);
  for (const entry of await fs.list(source)) {
    await copyTree(
      context,
      `${source}/${entry.name}`,
      `${target}/${entry.name}`,
      entry.kind,
    );
  }
}

/**
 * Deletes a file or folder: to the trash of the vault, to the system
 * trash with `system`, or for good with `permanent`. If it cannot go to the trash the call rejects and nothing is
 * deleted; deleting for good is never a silent fallback. Only what the
 * vault holds can be deleted (`isVaultPath`), not the drafts folder itself.
 */
export async function deleteEntry(
  context: VaultContext,
  path: string,
  kind: EntryKind,
  options: DeleteOptions = {},
): Promise<void> {
  const { root, fs, trash, systemTrash, own } = context;
  const target = resolveInVault(root, path);
  if (!isVaultPath(path) || path === DRAFTS_FOLDER) {
    throw new Error(`Not part of the vault: ${JSON.stringify(path)}`);
  }
  await expectKind(context, path, kind);
  if (options.permanent) await fs.remove(target, { recursive: kind === "dir" });
  else if (options.system) await systemTrash.moveToTrash(target);
  else await trash.put(slashed(path), kind);
  own.removed(target);
  await context.favorites.removed(slashed(path));
}
