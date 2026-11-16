import type { IndexStore } from "../index/index-store";
import { matchKey } from "../links/resolve";
import type { NotePath, TagCount } from "../types";

/** What `Tags` needs from the vault. */
export interface TagsContext {
  /** The index once it is open; rejects if there is none. */
  index(): Promise<IndexStore>;
}

/** A tag in the tree of tags: `topic` in `area/topic`. */
export interface TagNode {
  /** The last part of the tag: `topic`. */
  name: string;
  /** The whole tag: `area/topic`. */
  tag: string;
  /** Notes with the tag or a tag nested in it. */
  count: number;
  /** The tags nested one level in it, by name. */
  children: TagNode[];
}

/**
 * The tags of the vault, answered from the index. During the startup
 * scan the answers may miss notes it has not reached yet.
 */
export class Tags {
  constructor(private readonly context: TagsContext) {}

  /** Every tag with its count of notes (`IndexStore.tags`). */
  async all(): Promise<TagCount[]> {
    return (await this.context.index()).tags();
  }

  /** The tags as a tree: `tagTree` of `all`. */
  async tree(): Promise<TagNode[]> {
    return tagTree(await this.all());
  }

  /** The notes with the tag or a tag nested in it, by path. */
  async notes(tag: string): Promise<NotePath[]> {
    return (await this.context.index()).notesWithTag(tag);
  }
}

const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

/**
 * Tags, such as `IndexStore.tags` gives them, nested by their parts:
 * `area/topic` under `area`. Each level is ordered by name, as a person
 * reads it: ignoring case, with numbers by value. A tag whose parent is
 * not among `tags` stands at the top.
 */
export function tagTree(tags: readonly TagCount[]): TagNode[] {
  const top: TagNode[] = [];
  const byTag = new Map<string, TagNode>();
  // Parents first: a parent is shorter than the tags nested in it.
  const ordered = [...tags].sort((a, b) => a.tag.length - b.tag.length);
  for (const { tag, count } of ordered) {
    const slash = tag.lastIndexOf("/");
    const node: TagNode = {
      name: tag.slice(slash + 1),
      tag,
      count,
      children: [],
    };
    byTag.set(matchKey(tag), node);
    const parent =
      slash === -1 ? undefined : byTag.get(matchKey(tag.slice(0, slash)));
    (parent?.children ?? top).push(node);
  }
  const sort = (nodes: TagNode[]) => {
    nodes.sort((a, b) => collator.compare(a.name, b.name));
    for (const node of nodes) sort(node.children);
  };
  sort(top);
  return top;
}
