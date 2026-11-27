import type { TagNode } from "@carbon/core";
import { oneOf, preference } from "../settings/preference";
import { byName } from "../vault/by-name";

/** How the tags are ordered at each level of their tree, and which way. */
export type TagSort = "name-asc" | "name-desc" | "count-desc" | "count-asc";

/** In the order the sort menu lists them, a pair to each key. */
export const TAG_SORTS: readonly TagSort[] = [
  "name-asc",
  "name-desc",
  "count-desc",
  "count-asc",
];

/** The order of the tags: A to Z until another is picked. */
export const tagSortPreference = preference<TagSort>(
  "carbon.tags.sort",
  "name-asc",
  oneOf(TAG_SORTS),
);

/**
 * The tree of the tags with each level in the order of `sort`: by name,
 * A to Z as the core gives it or Z to A, or by the number of notes, the
 * most or the fewest first, those of the same number A to Z. A tag keeps
 * the tags nested in it.
 */
export function sortTags(
  nodes: readonly TagNode[],
  sort: TagSort,
): readonly TagNode[] {
  if (sort === "name-asc") return nodes;
  const compare = (a: TagNode, b: TagNode): number => {
    if (sort === "name-desc") return byName.compare(b.name, a.name);
    const count = sort === "count-desc" ? b.count - a.count : a.count - b.count;
    return count || byName.compare(a.name, b.name);
  };
  return nodes
    .map((node) =>
      node.children.length === 0
        ? node
        : { ...node, children: [...sortTags(node.children, sort)] },
    )
    .sort(compare);
}
