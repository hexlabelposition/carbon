import type { Link, NotePath } from "../types";

/**
 * How links find their notes (ARCHITECTURE.md, section 4.4). A link is
 * turned into keys, and the index matches the keys against notes, in this
 * order:
 *
 * 1. `path`: the path of a note. A wiki link names it from the vault root,
 *    a Markdown link relative to the note it is in.
 * 2. `name`: the file name of a note anywhere in the vault; the shortest
 *    path wins. Only a wiki link without a folder has one.
 * 3. The same `name` against the aliases of notes, again shortest path
 *    first.
 *
 * Matching ignores case, in every language, and the Unicode form of the
 * text: macOS hands out file names decomposed.
 */
export interface LinkKeys {
  path: string | null;
  name: string | null;
}

/** The form every key is compared in. */
export function matchKey(text: string): string {
  return text.normalize("NFC").toLowerCase();
}

/** What a note is found by: its path and its file name. */
export function noteKeys(path: NotePath): { path: string; name: string } {
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  return { path: matchKey(path), name: matchKey(name) };
}

/** The keys of a link written in the note at `source`. */
export function linkKeys(
  source: NotePath,
  link: Pick<Link, "kind" | "target">,
): LinkKeys {
  return link.kind === "wiki"
    ? wikiKeys(source, link.target)
    : markdownKeys(source, link.target);
}

function wikiKeys(source: NotePath, target: string): LinkKeys {
  // "[[#Heading]]" points into the note it is written in.
  if (target === "") return { path: matchKey(source), name: null };
  const written = target.replace(/^\/+/, "");
  const base = written.replace(/\.md$/i, "");
  if (base === "") return { path: null, name: null };
  return {
    path: matchKey(`${base}.md`),
    name: base.includes("/") ? null : matchKey(base),
  };
}

function markdownKeys(source: NotePath, target: string): LinkKeys {
  // A leading "/" is the vault root, as it is the site root on the web.
  const folder = target.startsWith("/") ? [] : source.split("/").slice(0, -1);
  const segments = [...folder];
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment !== "..") segments.push(segment);
    // Above the vault root: the note cannot be in the vault.
    else if (segments.pop() === undefined) return { path: null, name: null };
  }
  const path = segments.join("/");
  return { path: path === "" ? null : matchKey(path), name: null };
}

/**
 * Finds notes by link keys in a list of paths, the way the index does
 * (`resolvedId` in `index-store.ts`) without the alias step: for a vault
 * that is not in the index yet, such as the one after a rename.
 */
export class NoteFinder {
  private readonly byPath = new Map<string, NotePath[]>();
  private readonly byName = new Map<string, NotePath[]>();

  constructor(paths: Iterable<NotePath>) {
    for (const path of paths) {
      const keys = noteKeys(path);
      push(this.byPath, keys.path, path);
      push(this.byName, keys.name, path);
    }
    for (const list of this.byPath.values()) list.sort(byText);
    for (const list of this.byName.values()) list.sort(shortestFirst);
  }

  /**
   * The note a link with these keys resolves to by path or file name, or
   * `null`: then it resolves by alias, or not at all.
   */
  find(keys: LinkKeys): NotePath | null {
    const byPath = keys.path === null ? undefined : this.byPath.get(keys.path);
    if (byPath !== undefined) return byPath[0];
    const byName = keys.name === null ? undefined : this.byName.get(keys.name);
    return byName?.[0] ?? null;
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** SQLite's `ORDER BY length(path), path`: length in characters. */
function shortestFirst(a: string, b: string): number {
  return [...a].length - [...b].length || byText(a, b);
}
