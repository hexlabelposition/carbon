import type { FileSystem } from "../platform";
import { mapPool } from "../util/pool";

/** A folder in the vault tree. Empty folders are kept. */
export interface FolderNode {
  kind: "folder";
  name: string;
  /** Path relative to the vault root, `/` separated. */
  path: string;
  /** Folders first, then files, each group sorted by name. */
  children: TreeNode[];
}

/** A Markdown note (`note`) or any other file, such as an image (`file`). */
export interface FileNode {
  kind: "note" | "file";
  name: string;
  /** Path relative to the vault root, `/` separated. */
  path: string;
}

export type TreeNode = FolderNode | FileNode;

/** Folders listed at the same time. Listing is cheap (ARCHITECTURE.md, section 7). */
const LIST_CONCURRENCY = 32;

/** "Note 2" before "Note 10", and case does not matter. */
const byName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Lists the vault and returns the children of its root. Hidden files and
 * folders (names starting with a dot) are left out.
 */
export async function scanTree(
  fs: FileSystem,
  root: string,
): Promise<TreeNode[]> {
  const top: FolderNode = { kind: "folder", name: "", path: "", children: [] };

  // One level of the tree at a time, the folders of a level in parallel.
  let level = [top];
  while (level.length > 0) {
    const listed = await mapPool(level, LIST_CONCURRENCY, (folder) =>
      fs.list(folder.path === "" ? root : `${root}/${folder.path}`),
    );
    const next: FolderNode[] = [];
    level.forEach((folder, i) => {
      for (const entry of listed[i]) {
        if (entry.name.startsWith(".")) continue;
        const path =
          folder.path === "" ? entry.name : `${folder.path}/${entry.name}`;
        if (entry.kind === "dir") {
          const child: FolderNode = {
            kind: "folder",
            name: entry.name,
            path,
            children: [],
          };
          folder.children.push(child);
          next.push(child);
        } else {
          const kind = /\.md$/i.test(entry.name) ? "note" : "file";
          folder.children.push({ kind, name: entry.name, path });
        }
      }
      folder.children.sort(compareNodes);
    });
    level = next;
  }
  return top.children;
}

function compareNodes(a: TreeNode, b: TreeNode): number {
  if ((a.kind === "folder") !== (b.kind === "folder")) {
    return a.kind === "folder" ? -1 : 1;
  }
  // The collator treats "a" and "A" as equal; fall back to a stable order.
  return byName.compare(a.name, b.name) || (a.name < b.name ? -1 : 1);
}
