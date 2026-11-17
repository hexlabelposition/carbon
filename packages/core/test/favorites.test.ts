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

describe("vault.favorites", () => {
  test("keeps what was added, in order, once each", async () => {
    const { vault } = await setup({ "a.md": "", "b.md": "", "c.png": "" });
    await vault.favorites.add("b.md");
    await vault.favorites.add("a.md");
    await vault.favorites.add("c.png");
    await vault.favorites.add("b.md");
    expect(await vault.favorites.list()).toEqual(["b.md", "a.md", "c.png"]);
    await vault.favorites.remove("a.md");
    expect(await vault.favorites.list()).toEqual(["b.md", "c.png"]);
    expect(await vault.favorites.has("b.md")).toBe(true);
    expect(await vault.favorites.has("a.md")).toBe(false);
  });

  test("are kept in .carbon/favorites.json and read back", async () => {
    const { vault, fs, platform } = await setup({ "a.md": "" });
    await vault.favorites.add("a.md");
    expect(
      JSON.parse(await fs.readText(`${ROOT}/.carbon/favorites.json`)),
    ).toEqual({ items: ["a.md"] });
    vault.close();
    const again = await Vault.open(ROOT, platform);
    expect(await again.favorites.list()).toEqual(["a.md"]);
  });

  test("follow a note or a folder that is renamed", async () => {
    const { vault } = await setup({ "a.md": "", "dir/b.md": "" });
    await vault.favorites.add("a.md");
    await vault.favorites.add("dir/b.md");
    await vault.notes.rename("a.md", "A2.md");
    await vault.folders.rename("dir", "moved");
    expect(await vault.favorites.list()).toEqual(["A2.md", "moved/b.md"]);
  });

  test("follow a note into the drafts and back", async () => {
    const { vault } = await setup({ "a.md": "" });
    await vault.favorites.add("a.md");
    await vault.notes.rename("a.md", ".carbon/drafts/a.md");
    expect(await vault.favorites.list()).toEqual([".carbon/drafts/a.md"]);
  });

  test("drop what is deleted, a folder with all inside", async () => {
    const { vault } = await setup({ "a.md": "", "dir/b.md": "", "c.md": "" });
    for (const p of ["a.md", "dir/b.md", "c.md"]) await vault.favorites.add(p);
    await vault.notes.remove("a.md");
    await vault.folders.remove("dir", { permanent: true });
    expect(await vault.favorites.list()).toEqual(["c.md"]);
    expect(await vault.favorites.has("a.md")).toBe(false);
  });

  test("leave out, but keep, what another program moved away", async () => {
    const { vault, fs } = await setup({ "a.md": "", "b.md": "" });
    await vault.favorites.add("a.md");
    await vault.favorites.add("b.md");
    await fs.rename(`${ROOT}/a.md`, `${ROOT}/x.md`);
    expect(await vault.favorites.list()).toEqual(["b.md"]);
    await fs.rename(`${ROOT}/x.md`, `${ROOT}/a.md`);
    expect(await vault.favorites.list()).toEqual(["a.md", "b.md"]);
  });

  test("tell when they change", async () => {
    const { vault } = await setup({ "a.md": "" });
    let changes = 0;
    vault.on("favorites", () => changes++);
    await vault.favorites.add("a.md");
    await vault.favorites.add("a.md");
    await vault.notes.rename("a.md", "b.md");
    expect(changes).toBe(2);
  });

  test("a broken file is an empty list", async () => {
    const { vault, fs } = await setup({ "a.md": "" });
    await fs.writeTextAtomic(`${ROOT}/.carbon/favorites.json`, "{not json");
    expect(await vault.favorites.list()).toEqual([]);
  });

  test("entries that point outside are not trusted", async () => {
    const { vault, fs } = await setup({ "a.md": "" });
    await fs.writeTextAtomic(
      `${ROOT}/.carbon/favorites.json`,
      JSON.stringify({ items: ["../x.md", "a.md", 5] }),
    );
    expect(await vault.favorites.list()).toEqual(["a.md"]);
  });
});
