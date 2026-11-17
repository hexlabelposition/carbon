/** A graph sent to the layout worker: nodes by index, edges as pairs. */
export interface LayoutRequest {
  count: number;
  /** `[source0, target0, source1, target1, ...]`, node indexes. */
  edges: Uint32Array;
  /**
   * Where nodes start, `[x0, y0, ...]`, NaN for a node with no place
   * yet: positions kept from an earlier layout. `null` to start afresh.
   */
  start: Float32Array | null;
}

/**
 * Node positions, `[x0, y0, x1, y1, ...]`, sent as the layout settles:
 * every few ticks, then once more with `settled` when it stops.
 */
export interface LayoutFrame {
  positions: Float32Array;
  settled: boolean;
}
