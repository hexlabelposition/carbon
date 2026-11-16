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

  /**
   * The tags of the note at `path` as the index has them: as it was last
   * saved. Empty if it is not indexed.
   */
  async of(path: NotePath): Promise<string[]> {
    const metadata = await (await this.context.index()).metadata(path);
    return metadata?.tags ?? [];
  }

  /**
   * The tags to offer while a tag is typed in the note at `path`, whose
   * text has the tags `written` now, the one being typed left out. The
   * index has the note as last saved, which may hold a tag typed half
   * way: a tag only that note has comes from `written` instead. A tag of
   * `written` brings the tags it is nested in. Each with its count of
   * notes, the note at `path` counted once; in no order.
   */
  async suggestions(
    path: NotePath,
    written: readonly string[],
  ): Promise<TagCount[]> {
    const [all, own] = await Promise.all([this.all(), this.of(path)]);
    const inside = (tags: Iterable<string>) => {
      const keys = new Set<string>();
      for (const tag of tags) {
        const parts = matchKey(tag).split("/");
        for (let i = 1; i <= parts.length; i++) {
          keys.add(parts.slice(0, i).join("/"));
        }
      }
      return keys;
    };
    const saved = inside(own);
    const now = inside(written);

    const result = new Map<string, TagCount>();
    for (const { tag, count } of all) {
      const key = matchKey(tag);
      // Less the note itself as saved, plus the note as it is now.
      const others = count - (saved.has(key) ? 1 : 0);
      const total = others + (now.has(key) ? 1 : 0);
      if (total > 0) result.set(key, { tag, count: total });
    }
    for (const tag of written) {
      const parts = tag.split("/");
      for (let i = 1; i <= parts.length; i++) {
        const nested = parts.slice(0, i).join("/");
        const key = matchKey(nested);
        if (!result.has(key)) result.set(key, { tag: nested, count: 1 });
      }
    }
    return [...result.values()];
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
