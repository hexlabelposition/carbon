import type { IndexStore } from "../index/index-store";
import type { Backlink, Link, NotePath, UnresolvedTarget } from "../types";

/**
 * Questions about the links between notes, answered from the index
 * (ARCHITECTURE.md, section 6). The answers are what the index holds now:
 * during the startup scan they may miss notes it has not reached yet.
 */
export class Links {
  /**
   * `open` gives the index once it is open, `caughtUp` once it also holds
   * every change so far; both reject if there is no index.
   */
  constructor(
    private readonly open: () => Promise<IndexStore>,
    private readonly caughtUp: () => Promise<IndexStore>,
  ) {}

  /** The links in other notes that point to the note at `path`. */
  async backlinks(path: NotePath): Promise<Backlink[]> {
    return (await this.open()).backlinks(path);
  }

  /** The notes that links point to but that do not exist, with the links. */
  async unresolved(): Promise<UnresolvedTarget[]> {
    return (await this.open()).unresolved();
  }

  /**
   * The note a link written in the note at `source` points to, or `null`
   * if there is none: for following a link. Waits for the index to catch
   * up, so a note that is not indexed yet is not taken for a missing one.
   */
  async resolve(
    source: NotePath,
    link: Pick<Link, "kind" | "target">,
  ): Promise<NotePath | null> {
    return (await this.caughtUp()).resolve(source, link);
  }
}
