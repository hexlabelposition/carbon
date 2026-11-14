import fuzzysort from "fuzzysort";
import { titleOf } from "../parser/parse-note";
import type { NotePath, TextRange } from "../types";
import type { TreeNode } from "../vault/tree";

/** A note found by its title. */
export interface TitleHit {
  path: NotePath;
  /** `ParsedNote.title`. */
  title: string;
  /** The letters of `title` that match what was typed, in order. */
  matches: TextRange[];
  /** How well the title matches, from 0 to 1 for an exact match. */
  score: number;
}

interface Target {
  path: NotePath;
  title: string;
}

/**
 * Fuzzy matching of note titles, with fuzzysort (ADR-022): the letters
 * typed must come in the title in that order, not side by side. The notes
 * come from the vault tree, so it works before the index does; they are
 * prepared once for each new tree.
 */
export class TitleMatcher {
  private tree: readonly TreeNode[] | null = null;
  private snapshot = fuzzysort.snapshot<Target>([], { key: "title" });

  /**
   * The notes of `tree` whose titles match `text`, at most `limit`, the
   * best first: fuzzysort's score, then the shorter path, so a note at
   * the top of the vault comes before one deep inside of the same name.
   * Empty if `text` is blank.
   */
  match(tree: readonly TreeNode[], text: string, limit: number): TitleHit[] {
    if (text.trim() === "") return [];
    if (tree !== this.tree) {
      this.tree = tree;
      this.snapshot = fuzzysort.snapshot(targetsOf(tree), { key: "title" });
    }
    // Every match, not fuzzysort's best: ties are ours to break.
    const results = fuzzysort.go(text, this.snapshot, {
      limit: 0,
      threshold: 0,
    });
    return results
      .map((result) => ({
        path: result.obj.path,
        title: result.obj.title,
        matches: rangesOf(result.indexes),
        score: result.score,
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.path.length - b.path.length ||
          (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
      )
      .slice(0, limit);
  }
}

function targetsOf(tree: readonly TreeNode[]): Target[] {
  const targets: Target[] = [];
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === "folder") walk(node.children);
      else if (node.kind === "note") {
        targets.push({ path: node.path, title: titleOf(node.path) });
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
