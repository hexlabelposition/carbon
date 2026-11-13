import type { IndexStore } from "../index/index-store";
import { linkTargets, parseNote, type TextRange } from "../parser/parse-note";
import type { EntryKind } from "../platform";
import type { Link, NotePath } from "../types";
import { contentHash } from "../util/hash";
import { linkKeys, NoteFinder } from "./resolve";

/** What a rename did to the links of the vault. */
export interface LinkUpdate {
  /** Notes whose links were rewritten, by their path after the rename. */
  updated: NotePath[];
  /**
   * Notes whose links needed rewriting but were not written: they changed
   * since they were read, or could not be read or written.
   */
  failed: NotePath[];
}

/** What the rewriter needs from the vault. */
export interface RewriteHost {
  /** The index, caught up with every change so far. */
  index(): Promise<IndexStore>;
  read(path: NotePath): Promise<string>;
  /** `Notes.write`: rejects if the note is no longer `baseHash`. */
  write(path: NotePath, text: string, baseHash: string): Promise<unknown>;
}

/** A rename prepared before the files move; `apply` once they have. */
export interface Rewrite {
  apply(): Promise<LinkUpdate>;
}

interface Edit extends TextRange {
  text: string;
}

const NOTHING: Rewrite = { apply: async () => ({ updated: [], failed: [] }) };

/**
 * Keeps links pointing at notes that are renamed or moved
 * (ARCHITECTURE.md, section 4.4). The links are found before the move,
 * while the index still knows the old paths, and written after it:
 *
 * - links in any note that resolve to a moved note get its new path;
 * - Markdown links in a moved note get addresses relative to its new
 *   folder.
 *
 * A wiki link keeps its form: a name stays a name while that name finds
 * the note, else it becomes the path from the vault root. Headings,
 * aliases, `.md` and the spelling of Markdown addresses are kept. A link
 * that resolves through an alias needs no change and gets none. A link
 * to another note that a moved note takes over by name is not changed.
 */
export class LinkRewriter {
  constructor(private readonly host: RewriteHost) {}

  /**
   * Finds what moving the note or folder `from` to `to` breaks. Without
   * an index there is nothing to go by, and nothing is rewritten.
   */
  async prepare(from: string, to: string, kind: EntryKind): Promise<Rewrite> {
    const store = await this.host.index().catch(() => null);
    if (store === null) return NOTHING;

    const moveOf = (path: NotePath): NotePath | null => {
      if (kind === "file") return path === from ? to : null;
      return path.startsWith(`${from}/`) ? to + path.slice(from.length) : null;
    };
    const newPath = (path: NotePath) => moveOf(path) ?? path;

    const paths = [...(await store.stamps()).keys()];
    const moved = paths.filter((path) => moveOf(path) !== null);
    if (moved.length === 0) return NOTHING;
    const sources = new Set([...moved, ...(await store.linkSources(moved))]);

    const vault = {
      newPath,
      before: new NoteFinder(paths),
      after: new NoteFinder(paths.map(newPath)),
    };
    const plans: { path: NotePath; text: string; edits: Edit[] }[] = [];
    const failed: NotePath[] = [];
    for (const source of sources) {
      const text = await this.host.read(source).catch(() => null);
      if (text === null) {
        failed.push(newPath(source));
        continue;
      }
      const edits = editsFor(source, text, vault);
      if (edits.length > 0) plans.push({ path: source, text, edits });
    }

    return {
      apply: async () => {
        const update: LinkUpdate = { updated: [], failed };
        for (const { path, text, edits } of plans) {
          const target = newPath(path);
          try {
            await this.host.write(
              target,
              applyEdits(text, edits),
              contentHash(text),
            );
            update.updated.push(target);
          } catch {
            update.failed.push(target);
          }
        }
        return update;
      },
    };
  }
}

interface MovedVault {
  newPath(path: NotePath): NotePath;
  /** Finds notes in the vault as it is before the move. */
  before: NoteFinder;
  /** And after it. */
  after: NoteFinder;
}

/** The changes the text of the note at `source` needs. */
function editsFor(source: NotePath, text: string, vault: MovedVault): Edit[] {
  const ranges = linkTargets(text);
  const newSource = vault.newPath(source);
  const edits = new Map<number, Edit>();
  for (const link of parseNote(source, text).links) {
    const range = ranges.get(link.start);
    // Not found by path or name: through an alias, or not at all.
    const target = vault.before.find(linkKeys(source, link));
    if (range === undefined || target === null) continue;
    const newTarget = vault.newPath(target);
    const relative = link.kind === "markdown" && newSource !== source;
    if (newTarget === target && !relative) continue;

    const written = text.slice(range.from, range.to);
    const replacement = rewriteTarget(
      link,
      written,
      newSource,
      newTarget,
      vault,
    );
    // A definition shared by links by reference is changed once.
    if (replacement !== written) {
      edits.set(range.from, { ...range, text: replacement });
    }
  }
  return [...edits.values()];
}

function rewriteTarget(
  link: Link,
  written: string,
  source: NotePath,
  target: NotePath,
  vault: MovedVault,
): string {
  return link.kind === "wiki"
    ? wikiTarget(written, source, target, vault.after)
    : markdownAddress(written, source, target);
}

/** The note part of a wiki link in `source` that finds `target`. */
function wikiTarget(
  written: string,
  source: NotePath,
  target: NotePath,
  after: NoteFinder,
): string {
  const [, lead, core, trail] = /^(\s*)(.*?)(\s*)$/s.exec(written) ?? [];
  const root = core.startsWith("/") ? "/" : "";
  const bare = core.replace(/^\/+/, "");
  const base = target.replace(/\.md$/i, "");
  // "[[Note.md]]" stays with its extension.
  const extension = /\.md$/i.test(bare) ? target.slice(base.length) : "";

  if (!bare.includes("/")) {
    const name = base.slice(base.lastIndexOf("/") + 1) + extension;
    const found = after.find(linkKeys(source, { kind: "wiki", target: name }));
    if (found === target) return lead + name + trail;
  }
  return lead + root + base + extension + trail;
}

/** The address of a Markdown link in `source` that finds `target`. */
function markdownAddress(
  written: string,
  source: NotePath,
  target: NotePath,
): string {
  const angle = /^<.*>$/s.test(written);
  const inner = angle ? written.slice(1, -1) : written;
  const hash = inner.indexOf("#");
  const fragment = hash === -1 ? "" : inner.slice(hash);
  const old = decode(hash === -1 ? inner : inner.slice(0, hash)).trim();

  const path = old.startsWith("/")
    ? `/${target}`
    : relativePath(
        source.slice(0, Math.max(0, source.lastIndexOf("/"))),
        target,
      );
  if (path === old) return written;
  return angle ? `<${path}${fragment}>` : encodeAddress(path) + fragment;
}

/** The path from the folder `from` to `to`, both from the vault root. */
function relativePath(from: string, to: NotePath): string {
  const up = from === "" ? [] : from.split("/");
  const down = to.split("/");
  let shared = 0;
  while (
    shared < up.length &&
    shared < down.length - 1 &&
    up[shared] === down[shared]
  ) {
    shared++;
  }
  return [
    ...Array<string>(up.length - shared).fill(".."),
    ...down.slice(shared),
  ].join("/");
}

/** Escapes what would end or break an address written without `<>`. */
function encodeAddress(path: string): string {
  // `encodeURIComponent` leaves parentheses as they are.
  return path.replace(/[%\s()<>]/g, (c) =>
    c === "(" ? "%28" : c === ")" ? "%29" : encodeURIComponent(c),
  );
}

function decode(address: string): string {
  try {
    return decodeURIComponent(address);
  } catch {
    return address;
  }
}

/** The text with every edit made; the edits do not overlap. */
function applyEdits(text: string, edits: readonly Edit[]): string {
  let result = text;
  for (const edit of [...edits].sort((a, b) => b.from - a.from)) {
    result = result.slice(0, edit.from) + edit.text + result.slice(edit.to);
  }
  return result;
}
