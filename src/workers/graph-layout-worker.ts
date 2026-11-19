// The force layout of the graph view (C-503), off the UI thread. It sends
// the positions while it runs, so the graph shows at once and settles in
// view; the UI ends the worker to stop it.
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import type { LayoutFrame, LayoutRequest } from "./graph-layout-messages";
import { NODE_RADIUS } from "../features/graph/graph-renderer";
import { sizeFor } from "../features/graph/node-size";

/**
 * Free room around a note, in units of the layout, past its own radius:
 * notes never come closer than twice this, whatever their size.
 */
const ROOM = 12;
/** How long a link is between the edges of its two notes. */
const LINK_LENGTH = 45;

/**
 * Ticks at most: about 4 s for 10,000 nodes on a desktop machine. A
 * layout kept from before starts cooler and stops sooner.
 */
const MAX_TICKS = 300;
/** Time between two frames sent, ms: more often costs the UI redraws. */
const FRAME_MS = 100;

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { count, edges, start, warm } = event.data;
  const nodes: SimulationNodeDatum[] = Array.from({ length: count }, (_, i) => {
    const x = start?.[i * 2] ?? NaN;
    const y = start?.[i * 2 + 1] ?? NaN;
    // Without a place, d3 gives it one: on a spiral from the middle.
    return Number.isNaN(x) || Number.isNaN(y) ? {} : { x, y };
  });
  const links = [];
  const degree = new Uint32Array(count);
  for (let i = 0; i < edges.length; i += 2) {
    links.push({ source: edges[i], target: edges[i + 1] });
    degree[edges[i]]++;
    degree[edges[i + 1]]++;
  }
  // As big as the note is drawn when sized by its links, the largest it
  // gets: room enough whichever way the graph draws it.
  const radius = Array.from(degree, (links) => NODE_RADIUS * sizeFor(links));
  const index = (end: number | SimulationNodeDatum) =>
    typeof end === "number" ? end : (end.index ?? 0);
  const simulation = forceSimulation(nodes)
    // Barnes-Hut with a coarse theta: the repulsion of far nodes is
    // summed up, which the eye does not miss.
    .force("charge", forceManyBody().strength(-90).theta(0.9).distanceMax(800))
    // From edge to edge: two hubs linked stand as far apart as two dots.
    .force(
      "link",
      forceLink<
        SimulationNodeDatum,
        {
          source: number | SimulationNodeDatum;
          target: number | SimulationNodeDatum;
        }
      >(links)
        .distance(
          (link) =>
            LINK_LENGTH +
            radius[index(link.source)] +
            radius[index(link.target)],
        )
        .strength(0.1),
    )
    // No two notes closer than their radii and the room around them.
    .force(
      "collide",
      forceCollide<SimulationNodeDatum>(
        (_node, i) => radius[i] + ROOM,
      ).strength(0.7),
    )
    // Holds unlinked notes and separate groups near the middle.
    .force("x", forceX().strength(0.02))
    .force("y", forceY().strength(0.02))
    .alpha(warm ? 0.1 : 1)
    .alphaDecay(1 - Math.pow(0.001, 1 / MAX_TICKS))
    .stop();

  let sent = performance.now();
  for (
    let tick = 0;
    tick < MAX_TICKS && simulation.alpha() > simulation.alphaMin();
    tick++
  ) {
    simulation.tick();
    const now = performance.now();
    if (now - sent >= FRAME_MS) {
      send(nodes, false);
      sent = now;
    }
  }
  send(nodes, true);
};

function send(nodes: readonly SimulationNodeDatum[], settled: boolean) {
  const positions = new Float32Array(nodes.length * 2);
  nodes.forEach((node, i) => {
    positions[i * 2] = node.x ?? 0;
    positions[i * 2 + 1] = node.y ?? 0;
  });
  const frame: LayoutFrame = { positions, settled };
  self.postMessage(frame, { transfer: [positions.buffer] });
}
