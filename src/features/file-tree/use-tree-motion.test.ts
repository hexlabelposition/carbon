import { describe, expect, test } from "bun:test";
import type { TreeNode } from "@carbon/core";
import type { TreeRow } from "./use-file-tree";
import { findMotion } from "./use-tree-motion";

const folder = (path: string, depth: number): TreeRow => ({
  kind: "node",
  node: { kind: "folder", path } as TreeNode,
  depth,
});
const file = (path: string, depth: number): TreeRow => ({
  kind: "node",
  node: { kind: "file", path } as TreeNode,
  depth,
});

const closed = [folder("a", 0), folder("b", 0), file("c.md", 0)];
const open = [
  folder("a", 0),
  file("a/x.md", 1),
  file("a/y.md", 1),
  folder("b", 0),
  file("c.md", 0),
];

describe("findMotion", () => {
  test("a folder that opens shows its rows sliding out", () => {
    expect(findMotion(closed, open)).toEqual({
      kind: "open",
      at: 1,
      rows: open.slice(1, 3),
    });
  });

  test("a folder that closes hides its rows sliding back", () => {
    expect(findMotion(open, closed)).toEqual({
      kind: "close",
      at: 1,
      rows: open.slice(1, 3),
    });
  });

  test("the last folder of the list opens too", () => {
    const before = [file("c.md", 0), folder("z", 0)];
    const after = [...before, file("z/1.md", 1)];
    expect(findMotion(before, after)?.kind).toBe("open");
  });

  test("a row added at the top level is no motion", () => {
    expect(findMotion(closed, [...closed, file("d.md", 0)])).toBeNull();
  });

  test("a row replaced by another is no motion", () => {
    const renamed = [folder("a", 0), folder("b", 0), file("e.md", 0)];
    expect(findMotion(closed, renamed)).toBeNull();
  });

  test("the same rows are no motion", () => {
    expect(findMotion(closed, [...closed])).toBeNull();
  });
});
