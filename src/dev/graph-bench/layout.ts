import type { BenchGraph, Positions } from "./graph-data";
import type { LayoutMessage, LayoutRequest } from "./layout-worker";

/** Lays the graph out in a worker; `onProgress` gets done and total ticks. */
export function layOut(
  graph: BenchGraph,
  ticks: number,
  onProgress: (done: number, total: number) => void,
): Promise<{ positions: Positions; ms: number }> {
  const worker = new Worker(new URL("./layout-worker.ts", import.meta.url), {
    type: "module",
  });
  return new Promise((resolve, reject) => {
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.onmessage = (event: MessageEvent<LayoutMessage>) => {
      const message = event.data;
      if (message.kind === "progress") {
        onProgress(message.done, message.total);
        return;
      }
      worker.terminate();
      resolve({ positions: message.positions, ms: message.ms });
    };
    const request: LayoutRequest = {
      count: graph.titles.length,
      edges: graph.edges,
      ticks,
    };
    worker.postMessage(request);
  });
}
