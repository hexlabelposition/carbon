import { describe, expect, test } from "bun:test";
import type { FileTimes } from "@carbon/core";
import { sortBookmarks } from "./bookmark-sort";

// In the order they were added.
const paths = [
  "b/Zeta.md",
  "Alpha.md",
  "a/Zeta.md",
  "cat.png",
  "Note 10.md",
  "Note 2.md",
];

const times = new Map<string, FileTimes>([
  ["b/Zeta.md", { created: 1, modified: 30 }],
  ["Alpha.md", { created: 1, modified: 10 }],
  ["a/Zeta.md", { created: 1, modified: 30 }],
  ["cat.png", { created: 1, modified: 20 }],
]);

describe("sortBookmarks", () => {
  test("in the order added, the list as it is", () => {
    expect(sortBookmarks(paths, "added-asc", times)).toBe(paths);
  });

  test("the latest added first", () => {
    expect(sortBookmarks(paths, "added-desc", times)).toEqual(
      [...paths].reverse(),
    );
  });

  test("by name as shown, numbers by value, the same name by folder", () => {
    expect(sortBookmarks(paths, "name-asc", times)).toEqual([
      "Alpha.md",
      "cat.png",
      "Note 2.md",
      "Note 10.md",
      "a/Zeta.md",
      "b/Zeta.md",
    ]);
    expect(sortBookmarks(paths, "name-desc", times)).toEqual([
      "b/Zeta.md",
      "a/Zeta.md",
      "Note 10.md",
      "Note 2.md",
      "cat.png",
      "Alpha.md",
    ]);
  });

  test("by time changed, the same time by name, none known last", () => {
    expect(sortBookmarks(paths, "modified-desc", times)).toEqual([
      "a/Zeta.md",
      "b/Zeta.md",
      "cat.png",
      "Alpha.md",
      "Note 2.md",
      "Note 10.md",
    ]);
    expect(sortBookmarks(paths, "modified-asc", times)).toEqual([
      "Alpha.md",
      "cat.png",
      "a/Zeta.md",
      "b/Zeta.md",
      "Note 2.md",
      "Note 10.md",
    ]);
  });
});
