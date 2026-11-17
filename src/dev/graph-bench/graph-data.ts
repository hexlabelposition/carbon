import type { NoteGraph } from "@carbon/core";

/**
 * A graph as the renderers take it: nodes by index, edges as pairs of
 * node indexes in one flat array. Plain arrays, so it goes to the layout
 * worker as is.
 */
export interface BenchGraph {
  /** Node titles, by index. */
  titles: string[];
  /** `[source0, target0, source1, target1, ...]`. */
  edges: Uint32Array;
}

/** Node positions, `[x0, y0, x1, y1, ...]`, in layout units. */
export type Positions = Float32Array;

/** The graph of the vault as `vault.graph.global` gives it. */
export function fromNoteGraph(graph: NoteGraph): BenchGraph {
  const index = new Map(graph.nodes.map((node, i) => [node.path, i]));
  const edges = new Uint32Array(graph.edges.length * 2);
  let n = 0;
  for (const edge of graph.edges) {
    const source = index.get(edge.source);
    const target = index.get(edge.target);
    if (source === undefined || target === undefined) continue;
    edges[n++] = source;
    edges[n++] = target;
  }
  return {
    titles: graph.nodes.map((node) => node.title),
    edges: edges.slice(0, n),
  };
}

/**
 * A graph shaped like the vault of `bun gen:vault`: `count` notes, about
 * five links from each to notes picked at random. Seeded, so every run
 * draws the same graph.
 */
export function syntheticGraph(count: number, seed = 1): BenchGraph {
  let state = seed;
  // mulberry32
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pairs = new Set<number>();
  const edges: number[] = [];
  for (let source = 0; source < count; source++) {
    const links = Math.floor(random() * 10);
    for (let i = 0; i < links; i++) {
      const target = Math.floor(random() * count);
      const key = source * count + target;
      if (target === source || pairs.has(key)) continue;
      pairs.add(key);
      edges.push(source, target);
    }
  }
  return {
    titles: Array.from({ length: count }, (_, i) => `Note ${i}`),
    edges: Uint32Array.from(edges),
  };
}

/** The smallest box around the positions. */
export function bounds(positions: Positions) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 2) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }
  return { minX, minY, maxX, maxY };
}
