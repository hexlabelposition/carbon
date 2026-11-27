import type { FileTimes, TreeNode } from "@carbon/core";
import { oneOf, preference } from "../settings/preference";

/** How the file tree orders the files of a folder, and which way. */
export type TreeSort =
  | "name-asc"
  | "name-desc"
  | "created-desc"
  | "created-asc"
  | "modified-desc"
  | "modified-asc";

/** In the order the sort menu lists them, a pair to each key. */
export const TREE_SORTS: readonly TreeSort[] = [
  "name-asc",
  "name-desc",
  "created-desc",
  "created-asc",
  "modified-desc",
  "modified-asc",
];

/**
 * The order of the file tree and of the drafts, one setting for both: A
 * to Z until another is picked from the sort button of the explorer.
 */
export const treeSortPreference = preference<TreeSort>(
  "carbon.tree.sort",
  "name-asc",
  oneOf(TREE_SORTS),
);

/** "Note 2" before "Note 10", and case does not matter, as the core sorts. */
const byName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * `nodes` in the order of `sort`, folders always before files. By name,
 * A to Z as the core lists them, or Z to A, folders too. By the time a
 * file was made or last changed, the newest or the oldest first; the
 * folders stay A to Z, and files of the same time go A to Z. A file with
 * no time known goes last either way. A to Z, the tree is returned as it
 * is.
 */
export function sortTree(
  nodes: readonly TreeNode[],
  sort: TreeSort,
  times: ReadonlyMap<string, FileTimes>,
): TreeNode[] {
  if (sort === "name-asc") return nodes as TreeNode[];
  const [key, way] = sort.split("-") as [
    "name" | "created" | "modified",
    "asc" | "desc",
  ];
  const folders: TreeNode[] = [];
  const files: TreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === "folder") {
      folders.push({ ...node, children: sortTree(node.children, sort, times) });
    } else {
      files.push(node);
    }
  }
  if (key === "name") {
    const zToA = (a: TreeNode, b: TreeNode) => byName.compare(b.name, a.name);
    return [...folders.sort(zToA), ...files.sort(zToA)];
  }
  const timeOf = (node: TreeNode): number | undefined => {
    const known = times.get(node.path);
    return (key === "created" ? known?.created : known?.modified) ?? undefined;
  };
  files.sort((a, b) => {
    const at = timeOf(a);
    const bt = timeOf(b);
    if (at === undefined || bt === undefined) {
      if (at !== bt) return at === undefined ? 1 : -1;
    } else if (at !== bt) {
      return way === "desc" ? bt - at : at - bt;
    }
    return byName.compare(a.name, b.name);
  });
  return [...folders, ...files];
}
