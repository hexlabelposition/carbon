import type { IndexStore } from "../index/index-store";
import type { Backlink, NotePath } from "../types";

/**
 * Questions about the links between notes, answered from the index
 * (ARCHITECTURE.md, section 6). The answers are what the index holds now:
 * during the startup scan they may miss notes it has not reached yet.
 */
export class Links {
  /** `open` gives the index once it is open, or rejects if it is not. */
  constructor(private readonly open: () => Promise<IndexStore>) {}

  /** The links in other notes that point to the note at `path`. */
  async backlinks(path: NotePath): Promise<Backlink[]> {
    return (await this.open()).backlinks(path);
  }
}
