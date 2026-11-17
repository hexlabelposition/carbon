import { describe, expect, test } from "bun:test";
import { Vault } from "../src/index";
import { createMemoryPlatform } from "./fakes";

const ROOT = "/v";

async function setup(files: Record<string, string> = {}) {
  const seeded = Object.fromEntries(
    Object.entries(files).map(([path, text]) => [`${ROOT}/${path}`, text]),
  );
  const platform = createMemoryPlatform(seeded);
  await platform.fs.mkdir(ROOT);
  const vault = await Vault.open(ROOT, platform);
  return { vault, fs: platform.fs, platform };
}

describe("vault.bookmarks", () => {
  test("keeps what was added, in order, once each", async () => {
    const { vault } = await setup({ "a.md": "", "b.md": "", "c.png": "" });
    await vault.bookmarks.add("b.md");
    await vault.bookmarks.add("a.md");
    await vault.bookmarks.add("c.png");
    await vault.bookmarks.add("b.md");
    expect(await vault.bookmarks.list()).toEqual(["b.md", "a.md", "c.png"]);
    await vault.bookmarks.remove("a.md");
    expect(await vault.bookmarks.list()).toEqual(["b.md", "c.png"]);
    expect(await vault.bookmarks.has("b.md")).toBe(true);
    expect(await vault.bookmarks.has("a.md")).toBe(false);
  });

  test("are kept in .carbon/bookmarks.json and read back", async () => {
    const { vault, fs, platform } = await setup({ "a.md": "" });
    await vault.bookmarks.add("a.md");
    expect(
      JSON.parse(await fs.readText(`${ROOT}/.carbon/bookmarks.json`)),
    ).toEqual({ items: ["a.md"] });
    vault.close();
    const again = await Vault.open(ROOT, platform);
    expect(await again.bookmarks.list()).toEqual(["a.md"]);
  });

  test("follow a note or a folder that is renamed", async () => {
    const { vault } = await setup({ "a.md": "", "dir/b.md": "" });
    await vault.bookmarks.add("a.md");
    await vault.bookmarks.add("dir/b.md");
    await vault.notes.rename("a.md", "A2.md");
    await vault.folders.rename("dir", "moved");
    expect(await vault.bookmarks.list()).toEqual(["A2.md", "moved/b.md"]);
  });

  test("follow a note into the drafts and back", async () => {
    const { vault } = await setup({ "a.md": "" });
    await vault.bookmarks.add("a.md");
    await vault.notes.rename("a.md", ".carbon/drafts/a.md");
    expect(await vault.bookmarks.list()).toEqual([".carbon/drafts/a.md"]);
  });

  test("drop what is deleted, a folder with all inside", async () => {
    const { vault } = await setup({ "a.md": "", "dir/b.md": "", "c.md": "" });
    for (const p of ["a.md", "dir/b.md", "c.md"]) await vault.bookmarks.add(p);
    await vault.notes.remove("a.md");
    await vault.folders.remove("dir", { permanent: true });
    expect(await vault.bookmarks.list()).toEqual(["c.md"]);
    expect(await vault.bookmarks.has("a.md")).toBe(false);
  });

  test("leave out, but keep, what another program moved away", async () => {
    const { vault, fs } = await setup({ "a.md": "", "b.md": "" });
    await vault.bookmarks.add("a.md");
    await vault.bookmarks.add("b.md");
    await fs.rename(`${ROOT}/a.md`, `${ROOT}/x.md`);
    expect(await vault.bookmarks.list()).toEqual(["b.md"]);
    await fs.rename(`${ROOT}/x.md`, `${ROOT}/a.md`);
    expect(await vault.bookmarks.list()).toEqual(["a.md", "b.md"]);
  });

  test("tell when they change", async () => {
    const { vault } = await setup({ "a.md": "" });
    let changes = 0;
    vault.on("bookmarks", () => changes++);
    await vault.bookmarks.add("a.md");
    await vault.bookmarks.add("a.md");
    await vault.notes.rename("a.md", "b.md");
    expect(changes).toBe(2);
  });

  test("take over the favorites file of before, then delete it", async () => {
    const { fs, platform } = await setup({ "a.md": "", "b.md": "" });
    await fs.writeTextAtomic(
      `${ROOT}/.carbon/favorites.json`,
      JSON.stringify({ items: ["a.md"] }),
    );
    const vault = await Vault.open(ROOT, platform);
    expect(await vault.bookmarks.list()).toEqual(["a.md"]);
    await vault.bookmarks.add("b.md");
    expect(await fs.exists(`${ROOT}/.carbon/favorites.json`)).toBe(false);
    expect(
      JSON.parse(await fs.readText(`${ROOT}/.carbon/bookmarks.json`)),
    ).toEqual({ items: ["a.md", "b.md"] });
  });

  test("a broken file is an empty list", async () => {
    const { vault, fs } = await setup({ "a.md": "" });
    await fs.writeTextAtomic(`${ROOT}/.carbon/bookmarks.json`, "{not json");
    expect(await vault.bookmarks.list()).toEqual([]);
  });

  test("entries that point outside are not trusted", async () => {
    const { vault, fs } = await setup({ "a.md": "" });
    await fs.writeTextAtomic(
      `${ROOT}/.carbon/bookmarks.json`,
      JSON.stringify({ items: ["../x.md", "a.md", 5] }),
    );
    expect(await vault.bookmarks.list()).toEqual(["a.md"]);
  });
});
