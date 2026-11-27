import { describe, expect, test } from "bun:test";
import type { TrashItem } from "@carbon/core";
import { sortTrash } from "./trash-sort";

const item = (path: string, deletedAt: number): TrashItem => ({
  id: String(deletedAt),
  path,
  kind: path.endsWith(".md") ? "note" : "file",
  deletedAt,
});

// The latest deleted first, as the core lists them.
const items = [
  item("b/Beta.md", 5),
  item("Alpha.md", 4),
  item("a/Gamma.md", 3),
  item("b/Alpha.md", 2),
  item("cat.png", 1),
];

const paths = (list: readonly TrashItem[]): string[] => list.map((i) => i.path);

describe("sortTrash", () => {
  test("the latest deleted first, the list as it is", () => {
    expect(sortTrash(items, "deleted-desc")).toBe(items);
  });

  test("the earliest deleted first", () => {
    expect(paths(sortTrash(items, "deleted-asc"))).toEqual([
      "cat.png",
      "b/Alpha.md",
      "a/Gamma.md",
      "Alpha.md",
      "b/Beta.md",
    ]);
  });

  test("by name, the same name the latest deleted first", () => {
    expect(paths(sortTrash(items, "name-asc"))).toEqual([
      "Alpha.md",
      "b/Alpha.md",
      "b/Beta.md",
      "cat.png",
      "a/Gamma.md",
    ]);
    expect(paths(sortTrash(items, "name-desc"))).toEqual([
      "a/Gamma.md",
      "cat.png",
      "b/Beta.md",
      "Alpha.md",
      "b/Alpha.md",
    ]);
  });

  test("by folder, the root first, one folder A to Z", () => {
    expect(paths(sortTrash(items, "place-asc"))).toEqual([
      "Alpha.md",
      "cat.png",
      "a/Gamma.md",
      "b/Alpha.md",
      "b/Beta.md",
    ]);
    expect(paths(sortTrash(items, "place-desc"))).toEqual([
      "b/Alpha.md",
      "b/Beta.md",
      "a/Gamma.md",
      "Alpha.md",
      "cat.png",
    ]);
  });
});
