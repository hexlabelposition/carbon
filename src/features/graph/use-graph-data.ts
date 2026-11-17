import type { NoteGraph, Vault } from "@carbon/core";
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
 * The graph of the whole vault (`vault.graph.global`) while `enabled`.
 * Asked for again when the startup scan is done; later changes are left
 * for the graph to follow live (C-508).
 */
export function useGraphData(vault: Vault, enabled: boolean): GraphDataState {
  const [state, setState] = useState<GraphDataState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    let asked = 0;
    const ask = () => {
      // Only the latest answer counts: an older one may come in later.
      const request = ++asked;
      const fresh = () => current && request === asked;
      vault.graph.global().then(
        (graph) => {
          if (!fresh()) return;
          const partial = vault.indexStatus.state === "scanning";
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
  }, [vault, enabled]);

  return state;
}
