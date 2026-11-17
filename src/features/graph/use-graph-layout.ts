import type { NotePath, NoteGraph } from "@carbon/core";
import { useEffect, useMemo, useState } from "react";
import type {
  LayoutFrame,
  LayoutRequest,
} from "../../workers/graph-layout-messages";
import type { RenderedGraph } from "./graph-renderer";

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

  useEffect(() => {
    if (graph === null) return;
    const before = kept.get(root);
    let start: Float32Array | null = null;
    if (before !== undefined) {
      const places = new Float32Array(graph.paths.length * 2).fill(NaN);
      graph.paths.forEach((path, i) => {
        const place = before.get(path);
        if (place === undefined) return;
        places[i * 2] = place[0];
        places[i * 2 + 1] = place[1];
      });
      start = places;
    }
    const worker = new Worker(
      new URL("../../workers/graph-layout-worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<LayoutFrame>) => {
      const { positions, settled } = event.data;
      setLayout({ for: graph, positions, settled });
      if (!settled) return;
      const places = new Map<NotePath, [number, number]>();
      graph.paths.forEach((path, i) => {
        places.set(path, [positions[i * 2], positions[i * 2 + 1]]);
      });
      kept.set(root, places);
      worker.terminate();
    };
    worker.onerror = (event) => {
      console.error("The graph layout failed", event.message);
      worker.terminate();
    };
    const request: LayoutRequest = {
      count: graph.paths.length,
      edges: graph.edges,
      start,
    };
    worker.postMessage(request);
    return () => worker.terminate();
  }, [root, graph]);

  return useMemo(
    () =>
      layout.for === graph
        ? { positions: layout.positions, settled: layout.settled }
        : { positions: null, settled: false },
    [layout, graph],
  );
}
