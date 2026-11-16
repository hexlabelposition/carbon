import type { IndexStore } from "../index/index-store";
import type { NotePath, SearchHit } from "../types";
import { firstMatch } from "./locate";
import { fullTextQuery } from "./query";
import { TitleMatcher, type TitleHit } from "./titles";
import type { TreeNode } from "../vault/tree";

/** What `Search` needs from the vault. */
export interface SearchContext {
  /** The index once it is open; rejects if there is none. */
  index(): Promise<IndexStore>;
  /** `Notes.read`. */
  read(path: NotePath): Promise<string>;
  /** `Vault.tree`: the same array until something changes. */
  tree(): Promise<readonly TreeNode[]>;
}

export interface SearchOptions {
  /** The most hits to return, the best ones. */
  limit?: number;
}

export interface TitleOptions extends SearchOptions {
  /**
   * Notes to offer while nothing is typed, such as the recent ones: the
   * ones that still exist are the hits, in this order.
   */
  recent?: readonly NotePath[];
}

/** Enough for a list to scroll through; the best hits come first. */
const DEFAULT_LIMIT = 100;
/** A quick switcher shows a short list: past that, the user types on. */
const DEFAULT_TITLE_LIMIT = 50;

/**
 * Full-text search over the titles and bodies of notes, answered from the
 * index (ARCHITECTURE.md, section 6). During the startup scan it may miss
 * notes the scan has not reached yet.
 */
export class Search {
  private readonly matcher = new TitleMatcher();

  constructor(private readonly context: SearchContext) {}

  /**
   * The notes that have every word of `text`, as a word or the start of
   * one, and every `"exact phrase"`, in the title or the body; ignoring
   * case. With `path:folder`, only notes whose path has that text; with
   * `tag:name`, only notes with a tag that starts with it, so `tag:area`
   * finds `#area/topic` and `#areas`. The
   * best first: a word in the title counts for more than one in the body.
   * Empty if `text` asks for nothing (`fullTextQuery`).
   */
  async query(text: string, options: SearchOptions = {}): Promise<SearchHit[]> {
    const query = fullTextQuery(text);
    if (query === null) return [];
    const index = await this.context.index();
    return index.search(query, options.limit ?? DEFAULT_LIMIT);
  }

  /**
   * The notes whose titles match `text` fuzzily, the best first: for a
   * quick switcher (`TitleMatcher`). Works from the vault tree, so it
   * needs no index and knows a new note at once. While `text` is blank,
   * the notes of `options.recent` that exist, else nothing.
   */
  async titles(text: string, options: TitleOptions = {}): Promise<TitleHit[]> {
    const tree = await this.context.tree();
    const limit = options.limit ?? DEFAULT_TITLE_LIMIT;
    return text.trim() === ""
      ? this.matcher.existing(tree, options.recent ?? [], limit)
      : this.matcher.match(tree, text, limit);
  }

  /**
   * Where to open the note at `path` for a hit of `text`: the offset of
   * the first word of the body that the search matched (`firstMatch`), or
   * `null` to open it at the top. Rejects if the note cannot be read.
   */
  async locate(path: NotePath, text: string): Promise<number | null> {
    return firstMatch(await this.context.read(path), text);
  }
}
