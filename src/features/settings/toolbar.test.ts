import { describe, expect, test } from "bun:test";
import { moveTool, orderTools } from "./toolbar";

describe("orderTools", () => {
  test("nothing stored: the order of the tools", () => {
    expect(orderTools(["a", "b", "c"], [])).toEqual(["a", "b", "c"]);
  });

  test("in the order stored, those gone and twice dropped", () => {
    expect(orderTools(["a", "b", "c"], ["c", "x", "a", "c", "b"])).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  test("a new tool after the one it follows, or first", () => {
    expect(orderTools(["a", "n", "b", "c"], ["c", "b", "a"])).toEqual([
      "c",
      "b",
      "a",
      "n",
    ]);
    expect(orderTools(["n", "a", "b"], ["b", "a"])).toEqual(["n", "b", "a"]);
  });
});

describe("moveTool", () => {
  const none = new Set<string>();

  test("up and down among them all", () => {
    expect(moveTool(["a", "b", "c", "d"], none, "c", 0)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
    expect(moveTool(["a", "b", "c", "d"], none, "a", 2)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(moveTool(["a", "b", "c", "d"], none, "a", 3)).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
  });

  test("past the end, to the end", () => {
    expect(moveTool(["a", "b", "c"], none, "a", 9)).toEqual(["b", "c", "a"]);
  });

  test("among the shown ones, the hidden keep their places", () => {
    const hidden = new Set(["b"]);
    // Shown: a, c, d. "d" to the second place: before "c".
    expect(moveTool(["a", "b", "c", "d"], hidden, "d", 1)).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
    // "a" last: after "d", the last shown.
    expect(moveTool(["a", "b", "c", "d", "e"], new Set(["e"]), "a", 3)).toEqual(
      ["b", "c", "d", "a", "e"],
    );
  });
});
