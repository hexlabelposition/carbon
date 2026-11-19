import type { NotePath, NoteGraph } from "@carbon/core";
import { useEffect, useMemo, useState } from "react";
import type {
  LayoutFrame,
  LayoutRequest,
} from "../../workers/graph-layout-messages";
import type { RenderedGraph } from "./graph-renderer";
import { log } from "../log/log";

/** The graph as the renderers take it, with the path of each note. */
export interface IndexedGraph extends RenderedGraph {
  paths: readonly NotePath[];
  /** The tags of each note, by index (`GraphNode.tags`). */
  tags: readonly (readonly string[])[];
  indexOf: ReadonlyMap<NotePath, number>;
}

export interface GraphLayout {
  /** `[x0, y0, ...]` by note index; `null` until the first frame. */
  positions: Float32Array | null;
  /** The layout has stopped moving. */
  settled: boolean;
}

/**
 * The last positions of the notes of each vault, by its root: opened
 * again, the graph starts where it was left, and only new notes move far.
 * Kept while the app runs.
 */
const kept = new Map<string, Map<NotePath, [number, number]>>();

/** Notes by index and links as pairs of indexes. */
export function indexGraph(graph: NoteGraph): IndexedGraph {
  const paths = graph.nodes.map((node) => node.path);
  const indexOf = new Map(paths.map((path, i) => [path, i]));
  const edges = new Uint32Array(graph.edges.length * 2);
  let n = 0;
  for (const edge of graph.edges) {
    const source = indexOf.get(edge.source);
    const target = indexOf.get(edge.target);
    if (source === undefined || target === undefined) continue;
    edges[n++] = source;
    edges[n++] = target;
  }
  return {
    titles: graph.nodes.map((node) => node.title),
    missing: Uint8Array.from(graph.nodes, (node) => (node.missing ? 1 : 0)),
    edges: edges.slice(0, n),
    paths,
    tags: graph.nodes.map((node) => node.tags),
    indexOf,
  };
}

/**
 * Lays `graph` out with a force layout in a worker, the positions coming
 * in as it settles. A new graph starts a new layout; leaving stops it.
 */
export function useGraphLayout(
  root: string,
  graph: IndexedGraph | null,
): GraphLayout {
  const [layout, setLayout] = useState<
    GraphLayout & { for: IndexedGraph | null }
  >({
    for: null,
    positions: null,
    settled: false,
  });

  // Where the notes start: where they were, a new note by one it links
  // to. Ready with the graph, so the renderer does not wait for the
  // worker to draw it.
  const start = useMemo(
    () => (graph === null ? null : startPositions(root, graph)),
    [root, graph],
  );

  useEffect(() => {
    if (graph === null || start === null) return;
    const worker = new Worker(
      new URL("../../workers/graph-layout-worker.ts", import.meta.url),
      { type: "module" },
    );
    let last = start.positions;
    /** Keeps the positions, for the next layout of this vault. */
    const keep = () => {
      const places = new Map<NotePath, [number, number]>();
      graph.paths.forEach((path, i) => {
        places.set(path, [last[i * 2], last[i * 2 + 1]]);
      });
      kept.set(root, places);
    };
    worker.onmessage = (event: MessageEvent<LayoutFrame>) => {
      const { positions, settled } = event.data;
      last = positions;
      setLayout({ for: graph, positions, settled });
      if (!settled) return;
      keep();
      worker.terminate();
    };
    worker.onerror = (event) => {
      log.error("The graph layout failed", event.message);
      worker.terminate();
    };
    const request: LayoutRequest = {
      count: graph.paths.length,
      edges: graph.edges,
      start: start.fresh ? null : start.positions,
      warm: start.warm,
    };
    worker.postMessage(request);
    return () => {
      worker.terminate();
      // A layout stopped half way, as a note changed, is kept as it was:
      // the next starts from what was on screen.
      keep();
    };
  }, [root, graph, start]);

  return useMemo(
    () =>
      layout.for === graph
        ? { positions: layout.positions, settled: layout.settled }
        : {
            positions: start === null || start.fresh ? null : start.positions,
            settled: false,
          },
    [layout, graph, start],
  );
}

/** Below this share of notes kept, a layout starts from the full heat. */
const WARM_SHARE = 0.9;

/**
 * Where the notes of `graph` start: where the last layout of the vault
 * at `root` left them; a note it did not have beside a note it links to
 * or is linked from, a little apart, or else near the middle. `fresh`
 * when nothing was kept: d3 places them then. `warm` when most notes are
 * where they were: the layout only has to settle the rest.
 */
function startPositions(
  root: string,
  graph: IndexedGraph,
): { positions: Float32Array; fresh: boolean; warm: boolean } {
  const count = graph.paths.length;
  const positions = new Float32Array(count * 2).fill(NaN);
  const before = kept.get(root);
  if (before === undefined) return { positions, fresh: true, warm: false };
  let known = 0;
  graph.paths.forEach((path, i) => {
    const place = before.get(path);
    if (place === undefined) return;
    positions[i * 2] = place[0];
    positions[i * 2 + 1] = place[1];
    known++;
  });
  const placed = (i: number) => !Number.isNaN(positions[i * 2]);
  // Spread around the point they start from, by a golden angle, so new
  // notes beside one note do not start on top of each other.
  const spread = (i: number, x: number, y: number) => {
    const angle = i * 2.39996;
    const distance = 20 + (i % 7) * 4;
    positions[i * 2] = x + Math.cos(angle) * distance;
    positions[i * 2 + 1] = y + Math.sin(angle) * distance;
  };
  // Each pass places the new notes beside a placed one, so a chain of new
  // notes grows out from the old ones.
  let changed = true;
  while (changed) {
    changed = false;
    for (let edge = 0; edge < graph.edges.length / 2; edge++) {
      const a = graph.edges[edge * 2];
      const b = graph.edges[edge * 2 + 1];
      const [from, to] = placed(a) && !placed(b) ? [a, b] : [b, a];
      if (!placed(from) || placed(to)) continue;
      spread(to, positions[from * 2], positions[from * 2 + 1]);
      changed = true;
    }
  }
  for (let i = 0; i < count; i++) if (!placed(i)) spread(i, 0, 0);
  return {
    positions,
    fresh: false,
    warm: count > 0 && known / count >= WARM_SHARE,
  };
}
