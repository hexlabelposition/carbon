import fuzzysort from "fuzzysort";
import { titleOf } from "../parser/parse-note";
import type { NoteAlias, NotePath, TextRange } from "../types";
import type { TreeNode } from "../vault/tree";

/** A note found by its title. */
export interface TitleHit {
  path: NotePath;
  /** `ParsedNote.title`. */
  title: string;
  /**
   * The alias of the note that matched, if one matched better than the
   * title; `matches` are letters of the alias then.
   */
  alias?: string;
  /** The letters of `title`, or `alias`, that match what was typed. */
  matches: TextRange[];
  /** How well the title matches, from 0 to 1 for an exact match. */
  score: number;
}

interface Target {
  path: NotePath;
  title: string;
  alias?: string;
  /** What is matched: the title, or the alias. */
  name: string;
}

/**
 * Fuzzy matching of note titles, with fuzzysort (ADR-022): the letters
 * typed must come in the title in that order, not side by side. The notes
 * come from the vault tree, so it works before the index does; they are
 * prepared once for each new tree. The aliases of the notes, from the
 * index, are matched too, when given.
 */
export class TitleMatcher {
  private tree: readonly TreeNode[] | null = null;
  private aliases: readonly NoteAlias[] = [];
  private snapshot = fuzzysort.snapshot<Target>([], { key: "name" });
  private byPath = new Map<NotePath, Target>();

  /**
   * The notes of `tree` whose titles or `aliases` match `text`, at most
   * `limit`, the best first: fuzzysort's score, then the shorter path, so
   * a note at the top of the vault comes before one deep inside of the
   * same name. A note comes once, by its title or by the alias that
   * matches best; by the title when they match as well. Empty if `text`
   * is blank.
   */
  match(
    tree: readonly TreeNode[],
    text: string,
    limit: number,
    aliases: readonly NoteAlias[] = [],
  ): TitleHit[] {
    if (text.trim() === "") return [];
    this.prepare(tree, aliases);
    // Every match, not fuzzysort's best: ties are ours to break.
    const results = fuzzysort.go(text, this.snapshot, {
      limit: 0,
      threshold: 0,
    });
    const best = new Map<NotePath, TitleHit>();
    for (const result of results) {
      const { path, title, alias } = result.obj;
      const known = best.get(path);
      const better =
        known === undefined ||
        result.score > known.score ||
        (result.score === known.score && alias === undefined);
      if (!better) continue;
      const hit: TitleHit = {
        path,
        title,
        matches: rangesOf(result.indexes),
        score: result.score,
      };
      if (alias !== undefined) hit.alias = alias;
      best.set(path, hit);
    }
    return [...best.values()]
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.path.length - b.path.length ||
          (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
      )
      .slice(0, limit);
  }

  /**
   * The notes at `paths` that are in `tree`, in that order, at most
   * `limit`: as hits with nothing matched, such as the recent notes.
   */
  existing(
    tree: readonly TreeNode[],
    paths: readonly NotePath[],
    limit: number,
  ): TitleHit[] {
    this.prepare(tree, this.aliases);
    return paths
      .flatMap((path) => {
        const target = this.byPath.get(path);
        return target === undefined
          ? []
          : [{ path: target.path, title: target.title, matches: [], score: 0 }];
      })
      .slice(0, limit);
  }

  private prepare(tree: readonly TreeNode[], aliases: readonly NoteAlias[]) {
    if (tree === this.tree && aliases === this.aliases) return;
    if (tree !== this.tree) {
      this.byPath = new Map(
        targetsOf(tree).map((target) => [target.path, target]),
      );
    }
    this.tree = tree;
    this.aliases = aliases;
    const targets: Target[] = [...this.byPath.values()];
    // The aliases of notes in the tree: the index may lag behind it.
    for (const { path, alias } of aliases) {
      const note = this.byPath.get(path);
      if (note !== undefined && alias.trim() !== "") {
        targets.push({ path, title: note.title, alias, name: alias });
      }
    }
    this.snapshot = fuzzysort.snapshot(targets, { key: "name" });
  }
}

function targetsOf(tree: readonly TreeNode[]): Target[] {
  const targets: Target[] = [];
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === "folder") walk(node.children);
      else if (node.kind === "note") {
        const title = titleOf(node.path);
        targets.push({ path: node.path, title, name: title });
      }
    }
  };
  walk(tree);
  return targets;
}

/** Letter offsets as ranges, letters side by side in one. */
function rangesOf(indexes: readonly number[]): TextRange[] {
  const ranges: TextRange[] = [];
  for (const index of [...indexes].sort((a, b) => a - b)) {
    const last = ranges[ranges.length - 1];
    if (last?.end === index) last.end = index + 1;
    else ranges.push({ start: index, end: index + 1 });
  }
  return ranges;
}
