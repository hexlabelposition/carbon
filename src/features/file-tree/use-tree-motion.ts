import { useCallback, useState } from "react";
import type { TreeRow } from "./use-file-tree";

/**
 * A folder of the tree opening or closing, drawn as its rows sliding out
 * of it or back into it: the rows that came (`open`) or went (`close`),
 * and where, in the rows as they are now, they start.
 */
export interface TreeMotion {
  /** New for every motion, so its animation starts again. */
  key: number;
  kind: "open" | "close";
  at: number;
  rows: readonly TreeRow[];
}

let nextKey = 0;

/**
 * The motion from the rows of the last render to `rows`, if a folder
 * opened or closed in between; `done` ends it once it has been drawn.
 * Worked out while rendering, not after, so the new rows never show for
 * a frame at their full height before they slide out.
 */
export function useTreeMotion(rows: readonly TreeRow[]): {
  motion: TreeMotion | null;
  done: () => void;
} {
  const [previous, setPrevious] = useState(rows);
  const [motion, setMotion] = useState<TreeMotion | null>(null);
  if (previous !== rows) {
    setPrevious(rows);
    const found = reducedMotion() ? null : findMotion(previous, rows);
    setMotion(found === null ? null : { key: nextKey++, ...found });
  }
  const done = useCallback(() => setMotion(null), []);
  return { motion, done };
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function keyOf(row: TreeRow): string {
  return row.kind === "node" ? row.node.path : "\0new";
}

/**
 * Rows that came or went in one block, right below a folder and deeper
 * than it: the folder opened or closed. Anything else, as a note added
 * here and one removed there, is no motion.
 */
export function findMotion(
  before: readonly TreeRow[],
  after: readonly TreeRow[],
): Omit<TreeMotion, "key"> | null {
  const shorter = Math.min(before.length, after.length);
  let start = 0;
  while (start < shorter && keyOf(before[start]) === keyOf(after[start])) {
    start++;
  }
  let end = 0;
  while (
    end < shorter - start &&
    keyOf(before[before.length - 1 - end]) ===
      keyOf(after[after.length - 1 - end])
  ) {
    end++;
  }
  const removed = before.slice(start, before.length - end);
  const added = after.slice(start, after.length - end);
  if ((removed.length === 0) === (added.length === 0)) return null;

  const folder = after[start - 1];
  if (folder?.kind !== "node" || folder.node.kind !== "folder") return null;
  const block = added.length > 0 ? added : removed;
  if (block.some((row) => row.depth <= folder.depth)) return null;
  return { kind: added.length > 0 ? "open" : "close", at: start, rows: block };
}
