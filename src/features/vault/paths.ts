import type { TreeNode } from "@carbon/core";

// Helpers for vault-relative paths: `/` separated, "" is the vault root.

/** The folder a path is in; "" for something at the top of the vault. */
export function parentOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

/** The last part of a path: the file or folder name. */
export function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function joinPath(folder: string, name: string): string {
  return folder === "" ? name : `${folder}/${name}`;
}

/** True if `path` is `folder` itself or something inside it. */
export function isWithin(path: string, folder: string): boolean {
  return folder === "" || path === folder || path.startsWith(`${folder}/`);
}

/** Where `path` ends up after `from`, which it is within, moved to `to`. */
export function rebase(path: string, from: string, to: string): string {
  return to + path.slice(from.length);
}

/** The node at `path` in a vault tree, if there is one. */
export function findNode(
  tree: readonly TreeNode[],
  path: string,
): TreeNode | undefined {
  let nodes = tree;
  let found: TreeNode | undefined;
  for (const name of path.split("/")) {
    found = nodes.find((node) => node.name === name);
    if (found === undefined) return undefined;
    nodes = found.kind === "folder" ? found.children : [];
  }
  return found;
}
