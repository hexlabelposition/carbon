import type { IndexStore } from "../index/index-store";
import type { SearchHit } from "../types";
import { fullTextQuery } from "./query";

/** What `Search` needs from the vault. */
export interface SearchContext {
  /** The index once it is open; rejects if there is none. */
  index(): Promise<IndexStore>;
}

export interface SearchOptions {
  /** The most hits to return, the best ones. */
  limit?: number;
}

/** Enough for a list to scroll through; the best hits come first. */
const DEFAULT_LIMIT = 100;

/**
 * Full-text search over the titles and bodies of notes, answered from the
 * index (ARCHITECTURE.md, section 6). During the startup scan it may miss
 * notes the scan has not reached yet.
 */
export class Search {
  constructor(private readonly context: SearchContext) {}

  /**
   * The notes that have every word of `text`, as a word or the start of
   * one, in the title or the body; ignoring case. The best first: a word
   * in the title counts for more than one in the body. Empty if `text`
   * has no words.
   */
  async query(text: string, options: SearchOptions = {}): Promise<SearchHit[]> {
    const match = fullTextQuery(text);
    if (match === null) return [];
    const index = await this.context.index();
    return index.search(match, options.limit ?? DEFAULT_LIMIT);
  }
}
