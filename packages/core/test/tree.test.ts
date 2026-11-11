import { describe, expect, test } from "bun:test";
import { Vault, type TreeNode } from "../src/index";
import { createMemoryPlatform } from "./fakes";

async function treeOf(files: Record<string, string>, root = "/vault") {
  const vault = await Vault.open(root, createMemoryPlatform(files));
  return vault.tree();
}

/** The tree as indented lines: `folder/`, `note.md`, `(file) image.png`. */
function outline(nodes: TreeNode[], indent = ""): string[] {
  return nodes.flatMap((node) =>
    node.kind === "folder"
      ? [`${indent}${node.name}/`, ...outline(node.children, `${indent}  `)]
      : [`${indent}${node.kind === "file" ? "(file) " : ""}${node.name}`],
  );
}

describe("vault.tree", () => {
  test("returns nested folders with vault-relative paths", async () => {
    const tree = await treeOf({
      "/vault/Inbox.md": "",
      "/vault/projects/Carbon.md": "",
      "/vault/projects/archive/Old.md": "",
    });

    expect(tree).toEqual([
      {
        kind: "folder",
        name: "projects",
        path: "projects",
        children: [
          {
            kind: "folder",
            name: "archive",
            path: "projects/archive",
            children: [
              { kind: "note", name: "Old.md", path: "projects/archive/Old.md" },
            ],
          },
          { kind: "note", name: "Carbon.md", path: "projects/Carbon.md" },
        ],
      },
      { kind: "note", name: "Inbox.md", path: "Inbox.md" },
    ]);
  });

  test("sorts folders first, then by name, ignoring case, numbers in order", async () => {
    const tree = await treeOf({
      "/vault/note 10.md": "",
      "/vault/Note 2.md": "",
      "/vault/apple.md": "",
      "/vault/Banana.md": "",
      "/vault/zebra/a.md": "",
      "/vault/Alpha/a.md": "",
    });

    expect(outline(tree)).toEqual([
      "Alpha/",
      "  a.md",
      "zebra/",
      "  a.md",
      "apple.md",
      "Banana.md",
      "Note 2.md",
      "note 10.md",
    ]);
  });

  test("marks Markdown files as notes and everything else as files", async () => {
    const tree = await treeOf({
      "/vault/a.md": "",
      "/vault/B.MD": "",
      "/vault/diagram.png": "",
      "/vault/md": "",
    });

    expect(outline(tree)).toEqual([
      "a.md",
      "B.MD",
      "(file) diagram.png",
      "(file) md",
    ]);
  });

  test("leaves out hidden files and folders", async () => {
    const tree = await treeOf({
      "/vault/a.md": "",
      "/vault/.hidden.md": "",
      "/vault/.carbon/config.json": "{}",
      "/vault/.git/objects/x": "",
      "/vault/sub/.DS_Store": "",
    });

    expect(outline(tree)).toEqual(["sub/", "a.md"]);
  });

  test("keeps empty folders", async () => {
    const platform = createMemoryPlatform({ "/vault/a.md": "" });
    platform.fs.mkdir("/vault/empty/inside");
    const vault = await Vault.open("/vault", platform);

    expect(outline(await vault.tree())).toEqual([
      "empty/",
      "  inside/",
      "a.md",
    ]);
  });

  test("an empty vault has an empty tree", async () => {
    const platform = createMemoryPlatform();
    platform.fs.mkdir("/vault");
    const vault = await Vault.open("/vault", platform);

    expect(await vault.tree()).toEqual([]);
  });

  test("sees changes made after the vault was opened", async () => {
    const platform = createMemoryPlatform({ "/vault/a.md": "" });
    const vault = await Vault.open("/vault", platform);
    await platform.fs.writeTextAtomic("/vault/b.md", "");

    expect(outline(await vault.tree())).toEqual(["a.md", "b.md"]);
  });

  test("does not look outside the vault root", async () => {
    const tree = await treeOf({
      "/vault/a.md": "",
      "/vault2/b.md": "",
      "/other/c.md": "",
    });

    expect(outline(tree)).toEqual(["a.md"]);
  });
});
