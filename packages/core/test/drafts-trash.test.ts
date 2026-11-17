import { describe, expect, test } from "bun:test";
import { IndexStore, Vault, type TreeNode } from "../src/index";
import { createMemoryPlatform } from "./fakes";

const ROOT = "/v";
const DELAY = 5;

async function setup(files: Record<string, string> = {}) {
  const seeded = Object.fromEntries(
    Object.entries(files).map(([path, text]) => [`${ROOT}/${path}`, text]),
  );
  const platform = createMemoryPlatform(seeded);
  await platform.fs.mkdir(ROOT);
  const vault = await Vault.open(ROOT, platform, { changeDelayMs: DELAY });
  await vault.indexed();
  const index = await IndexStore.open(platform, ROOT);
  const indexed = async () => [...(await index.stamps()).keys()].sort();
  return { platform, fs: platform.fs, vault, indexed };
}

/** Lets the watcher report what happened, then the index catch up. */
async function settle(vault: Vault) {
  await new Promise((resolve) => setTimeout(resolve, DELAY * 4));
  await vault.indexed();
}

function flat(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) =>
    n.kind === "folder" ? [`${n.path}/`, ...flat(n.children)] : [n.path],
  );
}

describe(".carbon", () => {
  test("is made with the drafts folder when a vault opens", async () => {
    const { fs } = await setup({ "a.md": "" });
    expect((await fs.stat(`${ROOT}/.carbon/drafts`)).kind).toBe("dir");
  });

  test("is not in the tree", async () => {
    const { vault } = await setup({ "a.md": "" });
    expect(flat(await vault.tree())).toEqual(["a.md"]);
  });
});

describe("drafts", () => {
  test("are created in the drafts folder and kept out of the tree", async () => {
    const { vault } = await setup({ "a.md": "" });
    await vault.notes.create(".carbon/drafts/Idea.md", "idea");
    await vault.notes.create(".carbon/drafts/sub/More.md");
    expect(flat(await vault.tree())).toEqual(["a.md"]);
    expect(flat(await vault.drafts())).toEqual([
      ".carbon/drafts/sub/",
      ".carbon/drafts/sub/More.md",
      ".carbon/drafts/Idea.md",
    ]);
  });

  test("are empty while the folder does not exist", async () => {
    const { vault, fs } = await setup({ "a.md": "" });
    expect(await vault.drafts()).toEqual([]);
    await fs.remove(`${ROOT}/.carbon`, { recursive: true });
    expect(await vault.drafts()).toEqual([]);
  });

  test("are indexed by the startup scan and as they change", async () => {
    const { vault, indexed } = await setup({
      "a.md": "",
      ".carbon/drafts/Old.md": "old",
      ".carbon/other.md": "not a draft",
    });
    expect(await indexed()).toEqual([".carbon/drafts/Old.md", "a.md"]);
    await vault.notes.create(".carbon/drafts/New.md", "[[a]]");
    await vault.indexed();
    expect(await indexed()).toContain(".carbon/drafts/New.md");
  });

  test("are seen when another program adds one", async () => {
    const { vault, platform, indexed } = await setup({ "a.md": "" });
    await platform.fs.writeTextAtomic(`${ROOT}/.carbon/drafts/x.md`, "x");
    platform.watcher.emit({
      kind: "created",
      path: `${ROOT}/.carbon/drafts/x.md`,
    });
    await settle(vault);
    expect(await indexed()).toContain(".carbon/drafts/x.md");
  });

  test("take notes moved in from the vault", async () => {
    const { vault } = await setup({ "a.md": "" });
    await vault.notes.rename("a.md", ".carbon/drafts/a.md");
    expect(flat(await vault.tree())).toEqual([]);
    expect(flat(await vault.drafts())).toEqual([".carbon/drafts/a.md"]);
  });

  test("move into the vault with their links rewritten", async () => {
    const { vault, indexed } = await setup({
      "a.md": "[[.carbon/drafts/Idea]]",
      ".carbon/drafts/Idea.md": "idea",
    });
    await vault.notes.rename(".carbon/drafts/Idea.md", "Idea.md");
    await vault.indexed();
    expect(flat(await vault.tree())).toEqual(["a.md", "Idea.md"]);
    expect(await indexed()).toEqual(["Idea.md", "a.md"]);
    expect(await vault.notes.read("a.md")).not.toContain(".carbon");
  });

  test("hidden names inside the drafts are still rejected", async () => {
    const { vault } = await setup();
    await expect(
      vault.notes.create(".carbon/drafts/.secret.md"),
    ).rejects.toThrow("Hidden names");
    await expect(vault.folders.create(".carbon/drafts")).rejects.toThrow(
      "Hidden names",
    );
  });
});

describe("vault.trash", () => {
  test("keeps what was deleted, out of the tree and the index", async () => {
    const { vault, indexed } = await setup({
      "a.md": "",
      "dir/b.md": "b",
    });
    await vault.notes.remove("dir/b.md");
    await vault.indexed();
    expect(flat(await vault.tree())).toEqual(["dir/", "a.md"]);
    expect(await indexed()).toEqual(["a.md"]);
    const [item] = await vault.trash.list();
    expect(item).toMatchObject({ path: "dir/b.md", kind: "note" });
  });

  test("lists the latest deleted first", async () => {
    const { vault } = await setup({ "a.md": "", "b.md": "", "c.png": "" });
    await vault.notes.remove("a.md");
    await vault.notes.remove("c.png");
    await vault.notes.remove("b.md");
    expect((await vault.trash.list()).map((i) => [i.path, i.kind])).toEqual([
      ["b.md", "note"],
      ["c.png", "file"],
      ["a.md", "note"],
    ]);
  });

  test("restores a note to where it was, and indexes it", async () => {
    const { vault, indexed } = await setup({ "dir/b.md": "b" });
    await vault.notes.remove("dir/b.md");
    await vault.folders.remove("dir", { permanent: true });
    const [item] = await vault.trash.list();
    expect(await vault.trash.restore(item.id)).toBe("dir/b.md");
    await vault.indexed();
    expect(await vault.notes.read("dir/b.md")).toBe("b");
    expect(await indexed()).toEqual(["dir/b.md"]);
    expect(await vault.trash.list()).toEqual([]);
  });

  test("restores to a free name when the place is taken", async () => {
    const { vault } = await setup({ "b.md": "old" });
    await vault.notes.remove("b.md");
    await vault.notes.create("b.md", "new");
    const [item] = await vault.trash.list();
    expect(await vault.trash.restore(item.id)).toBe("b 1.md");
    expect(await vault.notes.read("b 1.md")).toBe("old");
    expect(await vault.notes.read("b.md")).toBe("new");
  });

  test("restores a folder with everything inside", async () => {
    const { vault, indexed } = await setup({ "dir/b.md": "", "dir/c.md": "" });
    await vault.folders.remove("dir");
    await vault.indexed();
    expect(await indexed()).toEqual([]);
    const [item] = await vault.trash.list();
    expect(item.kind).toBe("folder");
    await vault.trash.restore(item.id);
    await vault.indexed();
    expect(await indexed()).toEqual(["dir/b.md", "dir/c.md"]);
  });

  test("restores a draft to the drafts", async () => {
    const { vault } = await setup({ ".carbon/drafts/d.md": "d" });
    await vault.notes.remove(".carbon/drafts/d.md");
    expect(await vault.drafts()).toEqual([]);
    const [item] = await vault.trash.list();
    await vault.trash.restore(item.id);
    expect(flat(await vault.drafts())).toEqual([".carbon/drafts/d.md"]);
  });

  test("deletes one item, or all, for good", async () => {
    const { vault, fs } = await setup({ "a.md": "", "b.md": "" });
    await vault.notes.remove("a.md");
    await vault.notes.remove("b.md");
    const [first] = await vault.trash.list();
    await vault.trash.remove(first.id);
    expect((await vault.trash.list()).map((i) => i.path)).toEqual(["a.md"]);
    await vault.trash.empty();
    expect(await vault.trash.list()).toEqual([]);
    expect(await fs.exists(`${ROOT}/.carbon/trash`)).toBe(false);
  });

  test("tells when it changed", async () => {
    const { vault } = await setup({ "a.md": "" });
    let changes = 0;
    vault.on("trash", () => changes++);
    await vault.notes.remove("a.md");
    const [item] = await vault.trash.list();
    await vault.trash.restore(item.id);
    expect(changes).toBe(2);
  });

  test("an item without its info goes back to the root", async () => {
    const { vault, fs } = await setup();
    await fs.mkdir(`${ROOT}/.carbon/trash/5`);
    await fs.writeTextAtomic(`${ROOT}/.carbon/trash/5/n.md`, "n");
    expect(await vault.trash.list()).toMatchObject([
      { id: "5", path: "n.md", kind: "note", deletedAt: 5 },
    ]);
  });

  test("an info that points outside is not trusted", async () => {
    const { vault, fs } = await setup();
    await fs.mkdir(`${ROOT}/.carbon/trash/5`);
    await fs.writeTextAtomic(`${ROOT}/.carbon/trash/5/n.md`, "n");
    await fs.writeTextAtomic(
      `${ROOT}/.carbon/trash/5/.item.json`,
      JSON.stringify({ path: "../../n.md", deletedAt: 9 }),
    );
    expect(await vault.trash.list()).toMatchObject([
      { path: "n.md", deletedAt: 9 },
    ]);
  });

  test("rejects an id that is not an item", async () => {
    const { vault } = await setup();
    await expect(vault.trash.restore("../x")).rejects.toThrow("Not in");
    await expect(vault.trash.remove("..")).rejects.toThrow("Not in");
  });
});
