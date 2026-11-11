import type { NotePath } from "../types";

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
 * names are rejected: the entry would disappear from the tree at once.
 */
export function resolveNewInVault(root: string, path: NotePath): string {
  const absolute = resolveInVault(root, path);
  if (
    path
      .replaceAll("\\", "/")
      .split("/")
      .some((s) => s.startsWith("."))
  ) {
    throw new Error(`Hidden names are not allowed: ${JSON.stringify(path)}`);
  }
  return absolute;
}

/** The absolute path of the folder that contains `absolute`. */
export function parentOf(absolute: string): string {
  return absolute.slice(0, absolute.lastIndexOf("/"));
}
