import type { IndexStore } from "../index/index-store";
import { titleOf } from "../parser/parse-note";
import { fold } from "../search/fold";
import type {
  Backlink,
  Heading,
  Link,
  Mention,
  NoteAlias,
  NotePath,
  TextRange,
  UnresolvedTarget,
} from "../types";
import { contentHash } from "../util/hash";
import { mapPool } from "../util/pool";
import { findMentions, mentionQuery } from "./mentions";
import { linkPath, linksToFile } from "./resolve";
import { VaultError } from "../errors";

/** What `Links` needs from the vault. */
export interface LinksContext {
  /** The index once it is open; rejects if there is none. */
  index(): Promise<IndexStore>;
  /** The index once it also holds every change so far. */
  caughtUp(): Promise<IndexStore>;
  /** `Notes.create`: a new, empty note, with its folders. */
  createNote(path: NotePath): Promise<void>;
  /** `Notes.read`. */
  read(path: NotePath): Promise<string>;
  /** `Notes.write`: rejects if the note is not `baseHash` any more. */
  write(path: NotePath, text: string, baseHash: string): Promise<string>;
}

/**
 * Notes read at most to look for mentions of one note, the ones that
 * match best: a common title is mentioned in more notes than a list can
 * show.
 */
const MENTION_NOTES = 200;
/** Notes read at the same time while looking for mentions. */
const READ_CONCURRENCY = 16;

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

  /**
   * Every alias of every note, by path: other names a link finds the note
   * by (ARCHITECTURE.md, section 4.4).
   */
  async aliases(): Promise<NoteAlias[]> {
    return (await this.context.index()).aliases();
  }

  /** The notes that links point to but that do not exist, with the links. */
  async unresolved(): Promise<UnresolvedTarget[]> {
    return (await this.context.index()).unresolved();
  }

  /**
   * The places where other notes mention the note at `path` by its title
   * without a link (`findMentions`), by the path of their note, then in
   * written order. Reads those notes, so it is slower than `backlinks`.
   * A note that cannot be read is left out.
   */
  async unlinked(path: NotePath): Promise<Mention[]> {
    const title = titleOf(path);
    const match = mentionQuery(title);
    if (match === null) return [];
    const index = await this.context.index();
    const candidates = (
      await index.search({ match, paths: [], tags: [] }, MENTION_NOTES)
    ).filter((hit) => hit.path !== path);
    const found = await mapPool(candidates, READ_CONCURRENCY, async (hit) => {
      let text: string;
      try {
        text = await this.context.read(hit.path);
      } catch {
        return [];
      }
      return findMentions(text, title).map((mention) => ({
        source: hit.path,
        sourceTitle: hit.title,
        ...mention,
      }));
    });
    return found
      .flat()
      .sort((a, b) =>
        a.source === b.source
          ? a.start - b.start
          : a.source < b.source
            ? -1
            : 1,
      );
  }

  /**
   * Turns a mention of the note at `target` in the note at `source`, at
   * `at`, into a wiki link: `[[Title]]`, or `[[Title|as written]]` if it
   * is written otherwise. By the title while it finds the note, else by
   * its path. Rejects if the mention is not there any more, or the note
   * changed meanwhile.
   */
  async linkMention(
    source: NotePath,
    at: TextRange,
    target: NotePath,
  ): Promise<void> {
    const text = await this.context.read(source);
    const written = text.slice(at.start, at.end);
    const title = titleOf(target);
    const same = (a: string) => fold(a).text.replace(/\s+/g, " ");
    if (same(written) !== same(title)) {
      throw new VaultError(
        "mentionGone",
        title,
        `The mention of ${title} is not there any more`,
      );
    }
    const byTitle = await this.resolve(source, { kind: "wiki", target: title });
    const name = byTitle === target ? title : target.replace(/\.md$/i, "");
    const link = written === name ? `[[${name}]]` : `[[${name}|${written}]]`;
    await this.context.write(
      source,
      text.slice(0, at.start) + link + text.slice(at.end),
      contentHash(text),
    );
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
