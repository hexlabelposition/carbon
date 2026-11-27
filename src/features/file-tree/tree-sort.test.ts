import { describe, expect, test } from "bun:test";
import type { FileTimes, TreeNode } from "@carbon/core";
import { sortTree } from "./tree-sort";

const tree: TreeNode[] = [
  {
    kind: "folder",
    name: "b",
    path: "b",
    children: [
      { kind: "note", name: "Old.md", path: "b/Old.md" },
      { kind: "note", name: "New.md", path: "b/New.md" },
    ],
  },
  { kind: "folder", name: "a", path: "a", children: [] },
  { kind: "note", name: "First.md", path: "First.md" },
  { kind: "file", name: "cat.png", path: "cat.png" },
  { kind: "note", name: "Second.md", path: "Second.md" },
  { kind: "note", name: "Unknown.md", path: "Unknown.md" },
];

const times = new Map<string, FileTimes>([
  ["b/Old.md", { created: 1, modified: 10 }],
  ["b/New.md", { created: 2, modified: 5 }],
  ["First.md", { created: 3, modified: 30 }],
  ["cat.png", { created: 5, modified: 20 }],
  ["Second.md", { created: 3, modified: 40 }],
]);

const names = (nodes: readonly TreeNode[]): string[] =>
  nodes.map((node) => node.name);

describe("sortTree", () => {
  test("A to Z, leaves the tree as the core lists it", () => {
    expect(sortTree(tree, "name-asc", times)).toBe(tree);
  });

  test("Z to A, folders too, and still before the files", () => {
    const sorted = sortTree(tree, "name-desc", times);
    expect(names(sorted)).toEqual([
      "b",
      "a",
      "Unknown.md",
      "Second.md",
      "First.md",
      "cat.png",
    ]);
    const folder = sorted[0];
    expect(folder.kind === "folder" && names(folder.children)).toEqual([
      "Old.md",
      "New.md",
    ]);
  });

  test("by the time a file was made, the newest or the oldest first", () => {
    // Folders stay first, A to Z as listed; files of the same time go A to
    // Z, and one with no time last either way.
    expect(names(sortTree(tree, "created-desc", times))).toEqual([
      "b",
      "a",
      "cat.png",
      "First.md",
      "Second.md",
      "Unknown.md",
    ]);
    expect(names(sortTree(tree, "created-asc", times))).toEqual([
      "b",
      "a",
      "First.md",
      "Second.md",
      "cat.png",
      "Unknown.md",
    ]);
    const folder = sortTree(tree, "created-desc", times)[0];
    expect(folder.kind === "folder" && names(folder.children)).toEqual([
      "New.md",
      "Old.md",
    ]);
  });

  test("by the time it was last changed, the newest or the oldest first", () => {
    expect(names(sortTree(tree, "modified-desc", times)).slice(2)).toEqual([
      "Second.md",
      "First.md",
      "cat.png",
      "Unknown.md",
    ]);
    expect(names(sortTree(tree, "modified-asc", times)).slice(2)).toEqual([
      "cat.png",
      "First.md",
      "Second.md",
      "Unknown.md",
    ]);
  });
});
