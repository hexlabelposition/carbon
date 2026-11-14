import { describe, expect, test } from "bun:test";
import { Vault, type TreeNode } from "../src/index";
import { TitleMatcher } from "../src/search/titles";
import { createMemoryPlatform } from "./fakes";

/** A vault tree with these files; folders are made from their paths. */
function treeOf(...paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const path of paths) {
    const parts = path.split("/");
    let level = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join("/");
      let folder = level.find((node) => node.path === folderPath);
      if (folder === undefined) {
        folder = {
          kind: "folder",
          name: parts[i],
          path: folderPath,
          children: [],
        };
        level.push(folder);
      }
      if (folder.kind !== "folder")
        throw new Error(`Not a folder: ${folderPath}`);
      level = folder.children;
    }
    const name = parts[parts.length - 1];
    level.push({ kind: /\.md$/i.test(name) ? "note" : "file", name, path });
  }
  return root;
}

const match = (tree: TreeNode[], text: string, limit = 50) =>
  new TitleMatcher().match(tree, text, limit);
const paths = (hits: { path: string }[]) => hits.map((hit) => hit.path);

describe("TitleMatcher", () => {
  test("finds titles with the letters typed, in order", () => {
    const tree = treeOf("Carbon.md", "projects/Car rental.md", "Bacon.md");
    expect(paths(match(tree, "cbn"))).toEqual(["Carbon.md"]);
    expect(paths(match(tree, "car")).sort()).toEqual([
      "Carbon.md",
      "projects/Car rental.md",
    ]);
    expect(match(tree, "xyz")).toEqual([]);
  });

  test("matches the title, not the folder or the extension", () => {
    const tree = treeOf("projects/Idea.md");
    expect(match(tree, "proj")).toEqual([]);
    expect(match(tree, "md")).toEqual([]);
    expect(match(tree, "idea")[0].title).toBe("Idea");
  });

  test("puts an exact title first", () => {
    const tree = treeOf(
      "Notes on the garden.md",
      "Garden tools.md",
      "Garden.md",
      "Big garden.md",
    );
    expect(paths(match(tree, "garden"))[0]).toBe("Garden.md");
    expect(match(tree, "garden")[0].score).toBe(1);
  });

  test("puts the shorter path first between equal titles", () => {
    const tree = treeOf("a/b/Note.md", "Note.md", "a/Note.md");
    expect(paths(match(tree, "note"))).toEqual([
      "Note.md",
      "a/Note.md",
      "a/b/Note.md",
    ]);
  });

  test("tells which letters matched, side by side as one range", () => {
    const [hit] = match(treeOf("Carbon notes.md"), "carno");
    expect(hit.matches.map((r) => hit.title.slice(r.start, r.end))).toEqual([
      "Car",
      "no",
    ]);
  });

  test("ignores case and diacritics", () => {
    const tree = treeOf("Café Ünïcode.md", "Мій сад.md");
    expect(paths(match(tree, "cafe uni"))).toEqual(["Café Ünïcode.md"]);
    expect(paths(match(tree, "САД"))).toEqual(["Мій сад.md"]);
  });

  test("leaves out files that are not notes", () => {
    expect(match(treeOf("image.png", "Image.md"), "image")).toHaveLength(1);
  });

  test("returns at most `limit` hits, the best ones", () => {
    const tree = treeOf("ab.md", "a.md", "abc.md");
    expect(paths(match(tree, "a", 1))).toEqual(["a.md"]);
  });

  test("finds nothing for blank text", () => {
    expect(match(treeOf("a.md"), "")).toEqual([]);
    expect(match(treeOf("a.md"), "   ")).toEqual([]);
  });

  test("prepares the notes again for a new tree", () => {
    const matcher = new TitleMatcher();
    expect(matcher.match(treeOf("Old.md"), "new", 10)).toEqual([]);
    expect(paths(matcher.match(treeOf("New.md"), "new", 10))).toEqual([
      "New.md",
    ]);
  });

  test("matches 10,000 titles quickly", () => {
    const tree = treeOf(
      ...Array.from({ length: 10_000 }, (_, i) => `f${i % 50}/Note ${i}.md`),
    );
    const matcher = new TitleMatcher();
    matcher.match(tree, "n", 50);
    const start = performance.now();
    for (const text of ["n", "no", "not", "note 99", "n9"]) {
      matcher.match(tree, text, 50);
    }
    // The budget is 16 ms a query (ARCHITECTURE.md, section 1); five
    // queries in a slow test run get room.
    expect(performance.now() - start).toBeLessThan(5 * 50);
  });
});

describe("vault.search.titles", () => {
  test("knows a note as soon as it is created", async () => {
    const root = "/v";
    const platform = createMemoryPlatform({ [`${root}/Old.md`]: "" });
    const vault = await Vault.open(root, platform);
    expect(paths(await vault.search.titles("idea"))).toEqual([]);

    await vault.notes.create("dir/Idea.md");
    expect(paths(await vault.search.titles("idea"))).toEqual(["dir/Idea.md"]);
    await vault.notes.rename("dir/Idea.md", "Other.md");
    expect(paths(await vault.search.titles("idea"))).toEqual([]);
    vault.close();
  });
});
