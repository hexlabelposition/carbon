import { describe, expect, test } from "bun:test";
import {
  SNAP_HOLD,
  SNAP_REACH,
  UsualWidthPull,
  pullTowardsUsual,
} from "./panel-snap";

describe("pullTowardsUsual", () => {
  test("holds near the usual width, follows the pointer out of reach", () => {
    for (const d of [0, 3, SNAP_HOLD]) expect(pullTowardsUsual(d)).toBe(0);
    for (const d of [SNAP_REACH, 100]) expect(pullTowardsUsual(d)).toBe(d);
  });

  test("lets go without a jump, never going back or past the pointer", () => {
    let last = 0;
    for (let d = 0; d <= SNAP_REACH + 5; d += 0.25) {
      const at = pullTowardsUsual(d);
      expect(at).toBeGreaterThanOrEqual(last);
      expect(at - last).toBeLessThan(0.25 * 2.5);
      expect(at).toBeLessThanOrEqual(d);
      last = at;
    }
  });

  test("meets the pointer at the end of its reach", () => {
    expect(pullTowardsUsual(SNAP_REACH - 0.01)).toBeCloseTo(
      SNAP_REACH - 0.01,
      3,
    );
  });
});

describe("UsualWidthPull", () => {
  const usual = 300;

  test("a slow drag is held in passing", () => {
    const pull = new UsualWidthPull();
    const held = [];
    for (let x = 250; x <= 350; x += 2) held.push(pull.at(x, usual).held);
    expect(held).toContain(true);
  });

  test("a fast drag that skips the hold is held where it lands", () => {
    const pull = new UsualWidthPull();
    pull.at(usual - 20, usual);
    expect(pull.at(usual + 20, usual)).toEqual({ at: usual, held: true });
  });

  test("then lets go without a jump and is back to its reach", () => {
    const pull = new UsualWidthPull();
    pull.at(usual - 20, usual);
    let last = pull.at(usual + 20, usual).at;
    for (let x = usual + 20; x <= usual + 80; x += 0.5) {
      const { at } = pull.at(x, usual);
      expect(at).toBeGreaterThanOrEqual(last);
      expect(at - last).toBeLessThan(0.5 * 4);
      expect(at).toBeLessThanOrEqual(x);
      last = at;
    }
    expect(last).toBe(usual + 80);
    // Out of reach once, so on coming back the hold is as narrow as ever.
    expect(pull.at(usual + SNAP_HOLD + 4, usual).held).toBe(false);
  });

  test("a drag that jumps right over the reach is not held", () => {
    const pull = new UsualWidthPull();
    pull.at(usual - 60, usual);
    expect(pull.at(usual + 60, usual)).toEqual({ at: usual + 60, held: false });
  });

  test("reset forgets the last drag", () => {
    const pull = new UsualWidthPull();
    pull.at(usual - 20, usual);
    pull.reset();
    expect(pull.at(usual + 20, usual).held).toBe(false);
  });
});
