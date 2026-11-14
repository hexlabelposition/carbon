import { describe, expect, test } from "bun:test";
import { contentHash, indexFileName, IndexStore, Vault } from "../src/index";
import { createMemoryPlatform } from "./fakes";

const ROOT = "/v";
const DELAY = 5;

/** A vault with its startup scan done, and a second view of its index. */
async function setup(files: Record<string, string>) {
  const seeded = Object.fromEntries(
    Object.entries(files).map(([path, text]) => [`${ROOT}/${path}`, text]),
  );
  const platform = createMemoryPlatform(seeded);
  await platform.fs.mkdir(ROOT);
  const vault = await Vault.open(ROOT, platform, { changeDelayMs: DELAY });
  await vault.indexed();
  // The memory databases share their data between handles, like a file.
  const index = await IndexStore.open(platform, ROOT);
  const paths = async () => [...(await index.stamps()).keys()].sort();
  const targets = async (path: string) =>
    (await index.outgoingLinks(path)).map((link) => link.target);
  return { platform, vault, index, paths, targets };
}

/** Lets the watcher report what happened, then the index catch up. */
async function settle(vault: Vault) {
  await new Promise((resolve) => setTimeout(resolve, DELAY * 4));
  await vault.indexed();
}

describe("Indexer", () => {
  describe("changes made by the vault", () => {
    test("saving a note indexes it again", async () => {
      const { vault, targets } = await setup({ "a.md": "[[Old]]" });
      await vault.notes.write(
        "a.md",
        "[[New]] [[Other]]",
        contentHash("[[Old]]"),
      );
      await vault.indexed();
      expect(await targets("a.md")).toEqual(["New", "Other"]);
    });

    test("a created note is indexed, with its new folders", async () => {
      const { vault, paths, targets } = await setup({});
      await vault.notes.create("deep/inside/a.md", "[[B]]");
      await vault.indexed();
      expect(await paths()).toEqual(["deep/inside/a.md"]);
      expect(await targets("deep/inside/a.md")).toEqual(["B"]);
    });

    test("a renamed note moves in the index", async () => {
      const { vault, paths, targets } = await setup({ "a.md": "[[X]]" });
      await vault.notes.rename("a.md", "b.md");
      await vault.indexed();
      expect(await paths()).toEqual(["b.md"]);
      expect(await targets("b.md")).toEqual(["X"]);
    });

    test("the full text follows saves, renames and deletes", async () => {
      const { platform, vault } = await setup({ "a.md": "first draft" });
      const fullText = (query: string) =>
        platform.sql
          .raw(indexFileName(ROOT))
          ?.query<{ path: string }, [string]>(
            `SELECT n.path FROM notes_fts f JOIN notes n ON n.id = f.rowid
             WHERE notes_fts MATCH ? ORDER BY n.path`,
          )
          .all(query)
          .map((row) => row.path);

      await vault.notes.write("a.md", "final text", contentHash("first draft"));
      await vault.indexed();
      expect(fullText("draft")).toEqual([]);
      expect(fullText("final")).toEqual(["a.md"]);

      await vault.notes.rename("a.md", "b.md");
      await vault.indexed();
      expect(fullText("final")).toEqual(["b.md"]);
      expect(fullText("title: b")).toEqual(["b.md"]);

      await vault.notes.remove("b.md");
      await vault.indexed();
      expect(fullText("final")).toEqual([]);
    });

    test("a deleted note leaves the index, to the trash or for good", async () => {
      const { vault, paths } = await setup({
        "a.md": "",
        "b.md": "",
        "c.md": "",
      });
      await vault.notes.remove("a.md");
      await vault.notes.remove("b.md", { permanent: true });
      await vault.indexed();
      expect(await paths()).toEqual(["c.md"]);
    });

    test("a renamed folder moves every note inside", async () => {
      const { vault, paths } = await setup({
        "dir/a.md": "",
        "dir/sub/b.md": "",
        "other.md": "",
      });
      await vault.folders.rename("dir", "moved");
      await vault.indexed();
      expect(await paths()).toEqual([
        "moved/a.md",
        "moved/sub/b.md",
        "other.md",
      ]);
    });

    test("a deleted folder takes its notes out of the index", async () => {
      const { vault, paths } = await setup({
        "dir/a.md": "",
        "dir/sub/b.md": "",
        "dirt.md": "",
      });
      await vault.folders.remove("dir", { permanent: true });
      await vault.indexed();
      // "dirt.md" starts like "dir" but is not inside it.
      expect(await paths()).toEqual(["dirt.md"]);
    });

    test("an attachment is not a note", async () => {
      const { vault, paths } = await setup({});
      await vault.attachments.save("photo.png", new Uint8Array([1, 2]));
      await vault.indexed();
      expect(await paths()).toEqual([]);
    });
  });

  describe("changes made by other programs", () => {
    test("an added, changed or removed note", async () => {
      const { platform, vault, paths, targets } = await setup({
        "a.md": "[[One]]",
        "gone.md": "",
      });
      const { fs, watcher } = platform;
      await fs.writeTextAtomic(`${ROOT}/a.md`, "[[Two]]");
      watcher.emit({ kind: "modified", path: `${ROOT}/a.md` });
      await fs.writeTextAtomic(`${ROOT}/new.md`, "[[Three]]");
      watcher.emit({ kind: "created", path: `${ROOT}/new.md` });
      await fs.remove(`${ROOT}/gone.md`);
      watcher.emit({ kind: "removed", path: `${ROOT}/gone.md` });

      await settle(vault);
      expect(await paths()).toEqual(["a.md", "new.md"]);
      expect(await targets("a.md")).toEqual(["Two"]);
      expect(await targets("new.md")).toEqual(["Three"]);
    });

    test("a folder moved into the vault", async () => {
      const { platform, vault, paths } = await setup({});
      const { fs, watcher } = platform;
      await fs.mkdir(`${ROOT}/in/sub`);
      await fs.writeTextAtomic(`${ROOT}/in/a.md`, "");
      await fs.writeTextAtomic(`${ROOT}/in/sub/b.md`, "");
      // Only the folder is reported, as when it is moved in whole.
      watcher.emit({ kind: "created", path: `${ROOT}/in` });

      await settle(vault);
      expect(await paths()).toEqual(["in/a.md", "in/sub/b.md"]);
    });

    test("a folder deleted with its notes", async () => {
      const { platform, vault, paths } = await setup({
        "dir/a.md": "",
        "dir/b.md": "",
        "keep.md": "",
      });
      await platform.fs.remove(`${ROOT}/dir`, { recursive: true });
      platform.watcher.emit({ kind: "removed", path: `${ROOT}/dir` });

      await settle(vault);
      expect(await paths()).toEqual(["keep.md"]);
    });
  });

  test("changes during the startup scan are handled after it", async () => {
    const platform = createMemoryPlatform({ [`${ROOT}/a.md`]: "[[Before]]" });
    const vault = await Vault.open(ROOT, platform, { changeDelayMs: DELAY });
    // The scan has only started.
    await vault.notes.write("a.md", "[[After]]", contentHash("[[Before]]"));
    await vault.indexed();

    const index = await IndexStore.open(platform, ROOT);
    expect((await index.outgoingLinks("a.md")).map((l) => l.target)).toEqual([
      "After",
    ]);
  });

  test("a failed step does not stop the ones after it", async () => {
    const { platform, vault, targets } = await setup({
      "a.md": "[[A]]",
      "b.md": "[[B]]",
    });
    const readText = platform.fs.readText.bind(platform.fs);
    // The first read is the save's own check; the second is the index's.
    let reads = 0;
    platform.fs.readText = (path) => {
      if (path.endsWith("a.md") && ++reads === 2) {
        return Promise.reject(new Error("EIO"));
      }
      return readText(path);
    };
    await vault.notes.write("a.md", "[[A2]]", contentHash("[[A]]"));
    await vault.indexed();
    await vault.notes.write("b.md", "[[B2]]", contentHash("[[B]]"));
    await vault.indexed();

    expect(await targets("b.md")).toEqual(["B2"]);
  });

  test("nothing is indexed after the vault is closed", async () => {
    const { platform, vault, paths } = await setup({ "a.md": "" });
    vault.close();
    await platform.fs.writeTextAtomic(`${ROOT}/b.md`, "");
    platform.watcher.emit({ kind: "created", path: `${ROOT}/b.md` });
    await new Promise((resolve) => setTimeout(resolve, DELAY * 4));
    expect(await paths()).toEqual(["a.md"]);
  });
});
