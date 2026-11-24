import type { IndexedGraph } from "./use-graph-layout";

/** What colors the notes of the graph (C-507). */
export type ColorBy = "none" | "folder" | "tag";

/** How the notes of a graph are sized and colored. */
export interface GraphDisplay {
  /** A note is bigger the more links it has. */
  sizeByLinks: boolean;
  colorBy: ColorBy;
}

export const PLAIN: GraphDisplay = { sizeByLinks: false, colorBy: "none" };

/**
 * Groups that get a color, the largest first. The notes of every group
 * can stand side by side in a graph, and only three hues stay apart for
 * every kind of color vision then (`--cb-group-*`); the rest are drawn
 * as notes of no group.
 */
export const GROUP_SLOTS = 3;
export { MAX_NODE_SIZE, sizeFor } from "./node-size";

/** A group in the legend. */
export interface LegendGroup {
  /** Index into the colors of the groups. */
  slot: number;
  /** The folder or the tag, as the first of its notes spells it. */
  name: string;
  count: number;
}

/** The groups of the notes of one graph. */
export interface Groups {
  /** The slot of each note, by index; -1 for none. */
  of: Int8Array;
  /** The groups with a color, by slot. */
  legend: LegendGroup[];
  /** Notes of no group or of a group with no color. */
  others: number;
  /** The slot of each group with a color, by its key: kept for the next. */
  slots: ReadonlyMap<string, number>;
}

/**
 * What group a note is in: its folder at the vault root, or the first
 * part of its first tag, `area` for `#area/topic`, case ignored. A note
 * at the root or with no tag, and a missing note, is in none.
 */
function groupOf(
  graph: IndexedGraph,
  i: number,
  by: ColorBy,
): { key: string; name: string } | null {
  if (graph.missing[i] === 1) return null;
  if (by === "folder") {
    const path = graph.paths[i];
    const slash = path.indexOf("/");
    if (slash === -1) return null;
    const name = path.slice(0, slash);
    return { key: name.toLowerCase(), name };
  }
  const first = graph.tags[i][0];
  if (first === undefined) return null;
  const name = first.split("/")[0];
  return { key: name.toLowerCase(), name };
}

/**
 * The notes of `graph` in groups by `by`, the `GROUP_SLOTS` largest with
 * a color each. A group that had a slot in `before` keeps it while it
 * stays among the largest, so a filter does not repaint the groups.
 */
export function groupNotes(
  graph: IndexedGraph,
  by: Exclude<ColorBy, "none">,
  before: Groups | null,
): Groups {
  const count = graph.titles.length;
  const keys: (string | null)[] = new Array<string | null>(count).fill(null);
  const found = new Map<string, { name: string; count: number }>();
  for (let i = 0; i < count; i++) {
    const group = groupOf(graph, i, by);
    if (group === null) continue;
    keys[i] = group.key;
    const known = found.get(group.key);
    if (known === undefined)
      found.set(group.key, { name: group.name, count: 1 });
    else known.count++;
  }
  const largest = [...found.entries()]
    .sort((a, b) => b[1].count - a[1].count || (a[0] < b[0] ? -1 : 1))
    .slice(0, GROUP_SLOTS)
    .map(([key]) => key);

  const slots = new Map<string, number>();
  for (const key of largest) {
    const kept = before?.slots.get(key);
    if (kept !== undefined) slots.set(key, kept);
  }
  const free = Array.from({ length: GROUP_SLOTS }, (_, slot) => slot).filter(
    (slot) => ![...slots.values()].includes(slot),
  );
  for (const key of largest) {
    if (!slots.has(key)) slots.set(key, free.shift() ?? -1);
  }

  const of = new Int8Array(count).fill(-1);
  let others = 0;
  keys.forEach((key, i) => {
    const slot = key === null ? undefined : slots.get(key);
    if (slot === undefined) others++;
    else of[i] = slot;
  });
  const legend = [...slots.entries()]
    .map(([key, slot]) => {
      const group = found.get(key);
      return { slot, name: group?.name ?? key, count: group?.count ?? 0 };
    })
    .sort((a, b) => a.slot - b.slot);
  return { of, legend, others, slots };
}
