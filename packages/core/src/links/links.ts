import type { IndexStore } from "../index/index-store";
import type {
  Backlink,
  Heading,
  Link,
  NotePath,
  UnresolvedTarget,
} from "../types";
import { linkPath, linksToFile } from "./resolve";

/** What `Links` needs from the vault. */
export interface LinksContext {
  /** The index once it is open; rejects if there is none. */
  index(): Promise<IndexStore>;
  /** The index once it also holds every change so far. */
  caughtUp(): Promise<IndexStore>;
  /** `Notes.create`: a new, empty note, with its folders. */
  createNote(path: NotePath): Promise<void>;
}

/** The note a followed link leads to. */
export interface FollowedLink {
  path: NotePath;
  /** True if the note did not exist and was created for the link. */
  created: boolean;
}

/**
 * Questions about the links between notes, answered from the index
 * (ARCHITECTURE.md, section 6). The answers are what the index holds now:
 * during the startup scan they may miss notes it has not reached yet.
 */
export class Links {
  constructor(private readonly context: LinksContext) {}

  /** The links in other notes that point to the note at `path`. */
  async backlinks(path: NotePath): Promise<Backlink[]> {
    return (await this.context.index()).backlinks(path);
  }

  /** The notes that links point to but that do not exist, with the links. */
  async unresolved(): Promise<UnresolvedTarget[]> {
    return (await this.context.index()).unresolved();
  }

  /**
   * The headings of the note at `path`, in order, that a link can point
   * to with `[[Note#Heading]]`. Empty if the note is not indexed.
   */
  async headings(path: NotePath): Promise<Heading[]> {
    return (await this.context.index()).headings(path);
  }

  /**
   * The note a link written in the note at `source` points to, or `null`
   * if there is none. Waits for the index to catch up, so a note that is
   * not indexed yet is not taken for a missing one.
   */
  async resolve(
    source: NotePath,
    link: Pick<Link, "kind" | "target">,
  ): Promise<NotePath | null> {
    return (await this.context.caughtUp()).resolve(source, link);
  }

  /**
   * The note to open for a link written in the note at `source`: the one
   * it points to, or a new, empty note where the link would find it by
   * path (`linkPath`). A wiki link by name, `[[Idea]]`, gets its note at
   * the vault root. `null` if no note can be made for it: a link above the
   * vault root, or to a file that is not a note, as `[[file.pdf]]`
   * (`linksToFile`). Rejects if the note cannot be created, such as for a
   * name the file system refuses.
   */
  async follow(
    source: NotePath,
    link: Pick<Link, "kind" | "target">,
  ): Promise<FollowedLink | null> {
    const found = await this.resolve(source, link);
    if (found !== null) return { path: found, created: false };
    const path = linkPath(source, link);
    if (path === null || linksToFile(link)) return null;
    try {
      await this.context.createNote(path);
    } catch (error) {
      // Someone else made it in the meantime: that one is the note.
      const made = await this.resolve(source, link);
      if (made !== null) return { path: made, created: false };
      throw error;
    }
    return { path, created: true };
  }
}
