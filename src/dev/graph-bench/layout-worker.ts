// Force layout of the graph bench (C-502), off the UI thread. The real
// one comes with the graph view (C-503).
import {
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";

export interface LayoutRequest {
  count: number;
  edges: Uint32Array;
  ticks: number;
}

export type LayoutMessage =
  | { kind: "progress"; done: number; total: number }
  | { kind: "done"; positions: Float32Array; ms: number };

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { count, edges, ticks } = event.data;
  const started = performance.now();
  const nodes: SimulationNodeDatum[] = Array.from(
    { length: count },
    () => ({}),
  );
  const links = [];
  for (let i = 0; i < edges.length; i += 2) {
    links.push({ source: edges[i], target: edges[i + 1] });
  }
  const simulation = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-30).theta(0.9).distanceMax(400))
    .force("link", forceLink(links).distance(30).strength(0.05))
    .force("x", forceX().strength(0.03))
    .force("y", forceY().strength(0.03))
    .alphaDecay(1 - Math.pow(0.001, 1 / ticks))
    .stop();
  for (let tick = 0; tick < ticks; tick++) {
    simulation.tick();
    if (tick % 10 === 0) {
      post({ kind: "progress", done: tick, total: ticks });
    }
  }
  const positions = new Float32Array(count * 2);
  nodes.forEach((node, i) => {
    positions[i * 2] = node.x ?? 0;
    positions[i * 2 + 1] = node.y ?? 0;
  });
  post({ kind: "done", positions, ms: performance.now() - started }, [
    positions.buffer,
  ]);
};

function post(message: LayoutMessage, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer });
}
