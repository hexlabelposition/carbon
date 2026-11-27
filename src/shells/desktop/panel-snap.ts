/**
 * How far from its usual width, in pixels, the pointer pulls a side panel
 * being dragged towards that width: past it, the panel follows the
 * pointer again.
 */
export const SNAP_REACH = 32;

/** How far from its usual width, in pixels, the panel is held right at it. */
export const SNAP_HOLD = 8;

/**
 * Where the edge of a side panel goes, in pixels, with the pointer
 * `distance` pixels from its usual width (on either side): how far from
 * that width. Drawn to it as by a magnet, without a jump: within `hold`,
 * right there; from there to `reach` it lets go, slowly at first, then
 * catching up with the pointer, which it meets at `reach` moving at its
 * pace (a cubic Hermite curve: no step, no kink). Further, at the pointer.
 */
export function pullTowardsUsual(
  distance: number,
  hold = SNAP_HOLD,
  reach = SNAP_REACH,
): number {
  if (distance >= reach) return distance;
  if (distance <= hold) return 0;
  const span = reach - hold;
  const t = (distance - hold) / span;
  // From 0, still, at `hold`, to `reach`, at the pointer's pace.
  return reach * (3 * t ** 2 - 2 * t ** 3) + span * (t ** 3 - t ** 2);
}

/**
 * The pull of a side panel towards its usual width over one drag
 * (`pullTowardsUsual`), which does not let the pointer skip it: moved
 * fast, it can go from one side of that width to the other between two
 * events and land past the place it is held. Then it is held all the
 * same, and the place it is held at reaches as far as the pointer, so
 * letting go has no jump either; it is back to its usual size once the
 * pointer is out of reach or back on the other side.
 */
export class UsualWidthPull {
  /** Where the pointer was at the last move, as `at` was given it. */
  private last: number | null = null;
  /** How much further than `SNAP_HOLD` the panel is held, on `side`. */
  private extra = 0;
  private side = 0;

  /**
   * Where the edge goes, in pixels, with the pointer at `pointer` and the
   * usual width at `usual`, and whether it is held right at that width.
   */
  at(pointer: number, usual: number): { at: number; held: boolean } {
    const offset = pointer - usual;
    const side = Math.sign(offset);
    const distance = Math.abs(offset);
    const crossed =
      this.last !== null &&
      side !== 0 &&
      Math.sign(this.last - usual) === -side;
    this.last = pointer;

    if (side !== this.side) this.extra = 0;
    this.side = side;
    // Crossed between two events, past the hold: held where it landed.
    if (crossed && distance > SNAP_HOLD && distance < SNAP_REACH) {
      this.extra = distance - SNAP_HOLD;
    }
    const hold = SNAP_HOLD + this.extra;
    const reach = SNAP_REACH + this.extra;
    if (distance >= reach) this.extra = 0;
    const pulled = pullTowardsUsual(distance, hold, reach);
    return { at: usual + side * pulled, held: pulled === 0 };
  }

  /** A new drag: what the last one did is forgotten. */
  reset(): void {
    this.last = null;
    this.extra = 0;
    this.side = 0;
  }
}
