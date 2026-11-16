import { describe, expect, test } from "bun:test";
import { tagTree, Vault, type TagNode } from "../src/index";
import { createMemoryPlatform } from "./fakes";

/** A tree as `[name, count, children]`, the easiest form to read. */
type Shape = [string, number, Shape[]];
const shape = (nodes: TagNode[]): Shape[] =>
  nodes.map((node) => [node.name, node.count, shape(node.children)]);

describe("tagTree", () => {
  test("nests tags by their parts, keeping the whole tag", () => {
    const tree = tagTree([
      { tag: "area", count: 3 },
      { tag: "area/topic", count: 2 },
      { tag: "area/topic/deep", count: 1 },
      { tag: "idea", count: 1 },
    ]);
    expect(shape(tree)).toEqual([
      ["area", 3, [["topic", 2, [["deep", 1, []]]]]],
      ["idea", 1, []],
    ]);
    expect(tree[0].children[0].children[0].tag).toBe("area/topic/deep");
  });

  test("orders each level by name, ignoring case, numbers by value", () => {
    const tree = tagTree([
      { tag: "b", count: 1 },
      { tag: "B/x10", count: 1 },
      { tag: "B/x9", count: 1 },
      { tag: "a", count: 1 },
      { tag: "Ёлка", count: 1 },
      { tag: "C", count: 1 },
    ]);
    expect(shape(tree)).toEqual([
      ["a", 1, []],
      [
        "b",
        1,
        [
          ["x9", 1, []],
          ["x10", 1, []],
        ],
      ],
      ["C", 1, []],
      ["Ёлка", 1, []],
    ]);
  });

  test("puts a tag whose parent is missing at the top", () => {
    expect(shape(tagTree([{ tag: "a/b", count: 1 }]))).toEqual([["b", 1, []]]);
  });

  test("is empty without tags", () => {
    expect(tagTree([])).toEqual([]);
  });
});

describe("vault.tags", () => {
  async function openVault(files: Record<string, string>) {
    const platform = createMemoryPlatform(
      Object.fromEntries(
        Object.entries(files).map(([path, text]) => [`/v/${path}`, text]),
      ),
    );
    await platform.fs.mkdir("/v");
    const vault = await Vault.open("/v", platform, { changeDelayMs: 5 });
    await vault.indexed();
    return vault;
  }

  test("gives the tree and the notes of a tag, and sees saves", async () => {
    const vault = await openVault({
      "a.md": "---\ntags: [area/topic]\n---\n",
      "b.md": "#area #idea",
    });
    expect(shape(await vault.tags.tree())).toEqual([
      ["area", 2, [["topic", 1, []]]],
      ["idea", 1, []],
    ]);
    expect(await vault.tags.notes("area")).toEqual(["a.md", "b.md"]);

    await vault.notes.write("c.md", "#area/topic", null);
    await vault.indexed();
    expect(await vault.tags.notes("area/topic")).toEqual(["a.md", "c.md"]);
    vault.close();
  });

  test("rejects after the vault is closed", async () => {
    const vault = await openVault({});
    vault.close();
    await expect(vault.tags.all()).rejects.toThrow("The index is not open");
  });
});
