import type { NoteGraph, NotePath, Vault } from "@carbon/core";
import { useEffect, useState } from "react";

export type GraphDataState =
  | { status: "loading" }
  | {
      status: "ready";
      graph: NoteGraph;
      /** The startup scan is still running: some notes may be missing. */
      partial: boolean;
    }
  | { status: "error"; message: string };

/**
 * The graph of the whole vault (`vault.graph.global`) while `enabled`,
 * with the notes the filters keep (C-506): those with `tag` if it is not
 * blank, the notes that links miss with `missing`, notes without links
 * only with `orphans`. Asked for again when the startup scan is done and
 * when the filters change; later changes are left for the graph to
 * follow live (C-508).
 */
export function useGraphData(
  vault: Vault,
  enabled: boolean,
  filters: GraphFilters = DEFAULT_FILTERS,
): GraphDataState {
  const { tag, missing, orphans } = filters;
  const [state, setState] = useState<GraphDataState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    let asked = 0;
    const ask = () => {
      // Only the latest answer counts: an older one may come in later.
      const request = ++asked;
      const fresh = () => current && request === asked;
      vault.graph.global({ tag, missing }).then(
        (found) => {
          if (!fresh()) return;
          const partial = vault.indexStatus.state === "scanning";
          const graph = orphans ? found : withoutOrphans(found);
          setState({ status: "ready", graph, partial });
        },
        (reason: unknown) => {
          if (!fresh()) return;
          setState({
            status: "error",
            message: reason instanceof Error ? reason.message : String(reason),
          });
        },
      );
    };
    ask();
    const stop = vault.on("index:ready", ask);
    return () => {
      current = false;
      stop();
    };
  }, [vault, enabled, tag, missing, orphans]);

  return state;
}

/** What the graph of the vault shows (C-506). */
export interface GraphFilters {
  /** Only the notes with this tag or one nested in it; blank for all. */
  tag: string;
  /** Also the notes without links. */
  orphans: boolean;
  /** Also the notes that links point to but that do not exist. */
  missing: boolean;
}

export const DEFAULT_FILTERS: GraphFilters = {
  tag: "",
  orphans: true,
  missing: false,
};

/** The graph less the notes with no link to or from another one in it. */
export function withoutOrphans(graph: NoteGraph): NoteGraph {
  const linked = new Set<NotePath>();
  for (const edge of graph.edges) {
    linked.add(edge.source);
    linked.add(edge.target);
  }
  return {
    nodes: graph.nodes.filter((node) => linked.has(node.path)),
    edges: graph.edges,
  };
}

/**
 * The graph around the note at `path` (`vault.graph.local`), `depth`
 * links deep. Asked for again whenever the index takes in a change, as
 * the backlinks are; an answer equal to the one shown is dropped, so
 * saving a note whose links stay the same leaves the graph alone.
 */
export function useLocalGraphData(
  vault: Vault,
  path: NotePath,
  depth: number,
): GraphDataState {
  const [answer, setAnswer] = useState<{
    for: string;
    state: GraphDataState;
  } | null>(null);
  const key = `${depth}:${path}`;

  useEffect(() => {
    let current = true;
    let asked = 0;
    const ask = () => {
      const request = ++asked;
      const fresh = () => current && request === asked;
      vault.graph.local(path, depth).then(
        (graph) => {
          if (!fresh()) return;
          const partial = vault.indexStatus.state === "scanning";
          setAnswer((old) =>
            old !== null &&
            old.for === key &&
            old.state.status === "ready" &&
            old.state.partial === partial &&
            sameGraph(old.state.graph, graph)
              ? old
              : { for: key, state: { status: "ready", graph, partial } },
          );
        },
        (reason: unknown) => {
          if (!fresh()) return;
          setAnswer({
            for: key,
            state: {
              status: "error",
              message:
                reason instanceof Error ? reason.message : String(reason),
            },
          });
        },
      );
    };
    ask();
    const stops = [
      vault.on("index:ready", ask),
      vault.on("index:updated", ask),
    ];
    return () => {
      current = false;
      for (const stop of stops) stop();
    };
  }, [vault, path, depth, key]);

  // The graph of another note or depth is not shown for this one.
  return answer?.for === key ? answer.state : { status: "loading" };
}

/** The same notes, with the same titles, and the same links. */
function sameGraph(a: NoteGraph, b: NoteGraph): boolean {
  return (
    a.nodes.length === b.nodes.length &&
    a.edges.length === b.edges.length &&
    a.nodes.every((node, i) => {
      const other = b.nodes[i];
      return (
        node.path === other.path &&
        node.title === other.title &&
        node.missing === other.missing
      );
    }) &&
    a.edges.every((edge, i) => {
      const other = b.edges[i];
      return (
        edge.source === other.source &&
        edge.target === other.target &&
        edge.count === other.count
      );
    })
  );
}
