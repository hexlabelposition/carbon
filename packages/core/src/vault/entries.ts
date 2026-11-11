import type { EntryKind, FileSystem } from "../platform";
import type { OwnChanges } from "./own-changes";
import { parentOf, resolveInVault, resolveNewInVault } from "./path";

/** What the parts of a vault share: where it is and how to reach the disk. */
export interface VaultContext {
  /** Absolute path of the vault folder, `/` separated. */
  root: string;
  fs: FileSystem;
  /** Every change the vault makes is recorded here (see `OwnChanges`). */
  own: OwnChanges;
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
  { root, fs, own }: VaultContext,
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
}
