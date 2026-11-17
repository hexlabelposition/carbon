/** A graph sent to the layout worker: nodes by index, edges as pairs. */
export interface LayoutRequest {
  count: number;
  /** `[source0, target0, source1, target1, ...]`, node indexes. */
  edges: Uint32Array;
  /**
   * Where nodes start, `[x0, y0, ...]`: positions kept from an earlier
   * layout, a new node placed beside one it links to. `null` to start
   * afresh: d3 places the nodes then.
   */
  start: Float32Array | null;
  /** Most nodes are where they were: start cool, only settle the rest. */
  warm: boolean;
}

/**
 * Node positions, `[x0, y0, x1, y1, ...]`, sent as the layout settles:
 * every few ticks, then once more with `settled` when it stops.
 */
export interface LayoutFrame {
  positions: Float32Array;
  settled: boolean;
}
