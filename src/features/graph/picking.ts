/**
 * Finds the note under the pointer among thousands: the positions sorted
 * into a grid of square cells, so a lookup checks a few cells, not every
 * note. Built again for each new set of positions.
 */
export class NodeGrid {
  private readonly cells = new Map<string, number[]>();

  constructor(
    private readonly positions: Float32Array,
    private readonly cell: number,
  ) {
    for (let i = 0; i < positions.length / 2; i++) {
      const key = this.key(positions[i * 2], positions[i * 2 + 1]);
      const list = this.cells.get(key);
      if (list === undefined) this.cells.set(key, [i]);
      else list.push(i);
    }
  }

  /**
   * The note under `x`, `y`, or `null`: the one whose edge is nearest,
   * at most `pad` beyond it. `radiusOf` gives the radius of each note;
   * `reach` is the largest radius plus `pad`.
   */
  nearest(
    x: number,
    y: number,
    reach: number,
    pad: number,
    radiusOf: (index: number) => number,
  ): number | null {
    const cells = Math.ceil(reach / this.cell);
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    let best: number | null = null;
    let bestGap = pad;
    for (let gx = cx - cells; gx <= cx + cells; gx++) {
      for (let gy = cy - cells; gy <= cy + cells; gy++) {
        for (const i of this.cells.get(`${gx},${gy}`) ?? []) {
          const dx = this.positions[i * 2] - x;
          const dy = this.positions[i * 2 + 1] - y;
          // How far outside the note the point is; less than 0 inside it.
          const gap = Math.hypot(dx, dy) - radiusOf(i);
          if (gap <= bestGap) {
            bestGap = gap;
            best = i;
          }
        }
      }
    }
    return best;
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
  }
}
