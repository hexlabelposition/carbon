import type { NotePath } from "../types";

/** The folder of Carbon inside a vault: hidden, so it is not a note folder. */
export const CARBON_FOLDER = ".carbon";
/**
 * Drafts: notes that are indexed, found and linked as any other, but kept
 * out of the file tree (ADR-031).
 */
export const DRAFTS_FOLDER = `${CARBON_FOLDER}/drafts`;
/** Deleted notes, files and folders, until restored or emptied (ADR-031). */
export const TRASH_FOLDER = `${CARBON_FOLDER}/trash`;

/**
 * Whether a vault-relative path is part of what the vault holds: nothing
 * in it is hidden (a name starting with a dot), or it is in the drafts
 * folder and nothing below that is hidden.
 */
export function isVaultPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const visible = (rest: string) =>
    rest === "" || !rest.split("/").some((s) => s.startsWith("."));
  if (normalized === DRAFTS_FOLDER) return true;
  if (normalized.startsWith(`${DRAFTS_FOLDER}/`)) {
    return visible(normalized.slice(DRAFTS_FOLDER.length + 1));
  }
  return visible(normalized);
}

/** Normalizes a vault root: `/` separators, no trailing slash. */
export function normalizeRoot(root: string): string {
  const normalized = root.replaceAll("\\", "/").replace(/\/+$/, "");
  // "/" and "C:/" lose their only slash above; an empty root is never valid.
  if (normalized === "" || /^[A-Za-z]:$/.test(normalized)) {
    throw new Error(`Invalid vault root: ${JSON.stringify(root)}`);
  }
  return normalized;
}

/**
 * Rejects a name that cannot be used for a new vault folder: it must be
 * one visible folder name that every supported system accepts.
 */
export function checkVaultName(name: string): void {
  const invalid =
    name !== name.trim() ||
    name === "" ||
    name.startsWith(".") ||
    name.endsWith(".") ||
    /[\\/:*?"<>|]/.test(name);
  if (invalid) {
    throw new Error(`Invalid vault name: ${JSON.stringify(name)}`);
  }
}

/**
 * Turns a vault-relative path into an absolute one. Rejects anything that
 * could point outside the vault.
 */
export function resolveInVault(root: string, path: NotePath): string {
  const segments = path.replaceAll("\\", "/").split("/");
  const invalid =
    path === "" ||
    /^[A-Za-z]:/.test(path) ||
    segments.some((s) => s === "" || s === "." || s === "..");
  if (invalid) {
    throw new Error(`Invalid vault path: ${JSON.stringify(path)}`);
  }
  return `${root}/${segments.join("/")}`;
}

/**
 * Like `resolveInVault`, for a path that is about to be created. Hidden
 * names are rejected, except for the drafts folder: the entry would not be
 * part of the vault (`isVaultPath`).
 */
export function resolveNewInVault(root: string, path: NotePath): string {
  const absolute = resolveInVault(root, path);
  if (!isVaultPath(path) || path.replaceAll("\\", "/") === DRAFTS_FOLDER) {
    throw new Error(`Hidden names are not allowed: ${JSON.stringify(path)}`);
  }
  return absolute;
}

/** The absolute path of the folder that contains `absolute`. */
export function parentOf(absolute: string): string {
  return absolute.slice(0, absolute.lastIndexOf("/"));
}
