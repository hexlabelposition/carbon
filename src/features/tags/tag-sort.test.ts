import { describe, expect, test } from "bun:test";
import type { TagNode } from "@carbon/core";
import { sortTags } from "./tag-sort";

const tag = (
  name: string,
  count: number,
  children: TagNode[] = [],
): TagNode => ({
  name,
  tag: name,
  count,
  children,
});

// By name, as the core gives them.
const tree: TagNode[] = [
  tag("alpha", 2, [tag("one", 1), tag("two", 2)]),
  tag("beta", 5),
  tag("gamma", 2),
];

const names = (nodes: readonly TagNode[]): string[] => nodes.map((n) => n.name);

describe("sortTags", () => {
  test("A to Z, the tree as the core gives it", () => {
    expect(sortTags(tree, "name-asc")).toBe(tree);
  });

  test("Z to A, the nested tags too", () => {
    const sorted = sortTags(tree, "name-desc");
    expect(names(sorted)).toEqual(["gamma", "beta", "alpha"]);
    expect(names(sorted[2]!.children)).toEqual(["two", "one"]);
  });

  test("by the number of notes, the same number A to Z", () => {
    const most = sortTags(tree, "count-desc");
    expect(names(most)).toEqual(["beta", "alpha", "gamma"]);
    expect(names(most[1]!.children)).toEqual(["two", "one"]);
    expect(names(sortTags(tree, "count-asc"))).toEqual([
      "alpha",
      "gamma",
      "beta",
    ]);
  });

  test("leaves the tree it is given as it is", () => {
    sortTags(tree, "name-desc");
    expect(names(tree)).toEqual(["alpha", "beta", "gamma"]);
    expect(names(tree[0]!.children)).toEqual(["one", "two"]);
  });
});
