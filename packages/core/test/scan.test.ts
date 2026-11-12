import { describe, expect, test } from "bun:test";
import { contentHash, IndexStore, Vault } from "../src/index";
import { scanVault } from "../src/index/scan";
import { inlineParser } from "../src/parser/parse-files";
import { createMemoryPlatform, type MemoryPlatform } from "./fakes";

const ROOT = "/v";

/** A vault on the memory platform, with its index open beside it. */
async function setup(files: Record<string, string>) {
  const seeded = Object.fromEntries(
    Object.entries(files).map(([path, text]) => [`${ROOT}/${path}`, text]),
  );
  const platform = createMemoryPlatform(seeded);
  const store = await IndexStore.open(platform, ROOT);
  const reads = countReads(platform);
  const scan = (options: Partial<Parameters<typeof scanVault>[0]> = {}) =>
    scanVault({
      fs: platform.fs,
      root: ROOT,
      store,
      parser: inlineParser,
      ...options,
    });
  return { platform, store, reads, scan };
}

/** Counts the notes read, so a test can tell which ones were indexed. */
function countReads(platform: MemoryPlatform): string[] {
  const reads: string[] = [];
  const readText = platform.fs.readText.bind(platform.fs);
  platform.fs.readText = (path) => {
    reads.push(path.slice(ROOT.length + 1));
    return readText(path);
  };
  return reads;
}

const sorted = (paths: Iterable<string>) => [...paths].sort();

describe("scanVault", () => {
  test("indexes every note on the first start", async () => {
    const { store, scan } = await setup({
      "a.md": "# A\n[[b]]",
      "dir/b.md": "# B",
      "image.png": "not a note",
      ".hidden/c.md": "# hidden",
    });

    expect(await scan()).toEqual({ notes: 2, indexed: 2, removed: 0 });
    expect(sorted((await store.stamps()).keys())).toEqual(["a.md", "dir/b.md"]);
    expect(await store.outgoingLinks("a.md")).toMatchObject([{ target: "b" }]);
    expect(await store.headings("dir/b.md")).toMatchObject([{ text: "B" }]);
  });

  test("stamps each note with its file", async () => {
    const { platform, store, scan } = await setup({ "a.md": "text" });
    await scan();
    const stat = await platform.fs.stat(`${ROOT}/a.md`);
    expect((await store.stamps()).get("a.md")).toEqual({
      mtime: stat.mtime,
      size: stat.size,
      hash: contentHash("text"),
    });
  });

  test("reads only new and changed notes later", async () => {
    const { platform, reads, scan } = await setup({
      "same.md": "same",
      "changed.md": "old",
    });
    await scan();
    reads.length = 0;

    await platform.fs.writeTextAtomic(`${ROOT}/changed.md`, "new");
    await platform.fs.writeTextAtomic(`${ROOT}/new.md`, "new note");

    expect(await scan()).toEqual({ notes: 3, indexed: 2, removed: 0 });
    expect(sorted(reads)).toEqual(["changed.md", "new.md"]);
  });

  test("indexes a note again when only its size changed", async () => {
    const { platform, store, scan } = await setup({ "a.md": "[[old]]" });
    await scan();
    const before = (await store.stamps()).get("a.md");
    // Same time, other content: a tool that keeps the time.
    const writeTime = before?.mtime ?? 0;
    await platform.fs.writeTextAtomic(`${ROOT}/a.md`, "[[newer]]");
    const stat = platform.fs.stat.bind(platform.fs);
    platform.fs.stat = async (path) => ({
      ...(await stat(path)),
      mtime: writeTime,
    });

    expect((await scan()).indexed).toBe(1);
    expect(await store.outgoingLinks("a.md")).toMatchObject([
      { target: "newer" },
    ]);
  });

  test("drops notes that are gone", async () => {
    const { platform, store, scan } = await setup({
      "a.md": "# A",
      "dir/b.md": "# B",
    });
    await scan();
    await platform.fs.remove(`${ROOT}/dir`, { recursive: true });

    expect(await scan()).toEqual({ notes: 1, indexed: 0, removed: 1 });
    expect(sorted((await store.stamps()).keys())).toEqual(["a.md"]);
    expect(await store.headings("dir/b.md")).toEqual([]);
  });

  test("sees a moved note as one gone and one new", async () => {
    const { platform, store, scan } = await setup({ "a.md": "# A" });
    await scan();
    await platform.fs.rename(`${ROOT}/a.md`, `${ROOT}/moved.md`);

    expect(await scan()).toEqual({ notes: 1, indexed: 1, removed: 1 });
    expect(sorted((await store.stamps()).keys())).toEqual(["moved.md"]);
  });

  test("leaves out a note that cannot be read, and tries it again", async () => {
    const { platform, store, scan } = await setup({
      "a.md": "# A",
      "locked.md": "# Locked",
    });
    const readText = platform.fs.readText;
    platform.fs.readText = (path) =>
      path.endsWith("locked.md")
        ? Promise.reject(new Error("EACCES"))
        : readText(path);

    expect(await scan()).toEqual({ notes: 2, indexed: 1, removed: 0 });
    expect(sorted((await store.stamps()).keys())).toEqual(["a.md"]);

    platform.fs.readText = readText;
    expect((await scan()).indexed).toBe(1);
    expect(sorted((await store.stamps()).keys())).toEqual([
      "a.md",
      "locked.md",
    ]);
  });

  test("drops an indexed note that can no longer be read", async () => {
    const { platform, store, scan } = await setup({ "a.md": "# A" });
    await scan();
    await platform.fs.writeTextAtomic(`${ROOT}/a.md`, "# A changed");
    platform.fs.readText = () => Promise.reject(new Error("EACCES"));

    expect(await scan()).toEqual({ notes: 1, indexed: 0, removed: 1 });
    expect((await store.stamps()).size).toBe(0);
  });

  test("handles a note gone between listing and looking at it", async () => {
    const { platform, store, scan } = await setup({
      "a.md": "# A",
      "b.md": "",
    });
    await scan();
    const stat = platform.fs.stat.bind(platform.fs);
    platform.fs.stat = (path) =>
      path.endsWith("b.md") ? Promise.reject(new Error("ENOENT")) : stat(path);

    expect(await scan()).toEqual({ notes: 2, indexed: 0, removed: 1 });
    expect(sorted((await store.stamps()).keys())).toEqual(["a.md"]);
  });

  test("works in batches and reports progress", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 450; i++) files[`n${i}.md`] = `[[n${i + 1}]]`;
    const { store, scan } = await setup(files);
    const progress: { done: number; total: number }[] = [];

    expect((await scan({ onProgress: (p) => progress.push(p) })).indexed).toBe(
      450,
    );
    expect(progress).toEqual([
      { done: 0, total: 450 },
      { done: 200, total: 450 },
      { done: 400, total: 450 },
      { done: 450, total: 450 },
    ]);
    expect((await store.stamps()).size).toBe(450);
  });

  test("parses with the parser it is given, in batches", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 250; i++) files[`n${i}.md`] = `# ${i}`;
    const { store, scan } = await setup(files);
    const batches: number[] = [];

    await scan({
      parser: {
        parse: async (batch) => {
          batches.push(batch.length);
          return inlineParser.parse(batch);
        },
      },
    });
    expect(batches).toEqual([200, 50]);
    expect((await store.headings("n7.md"))[0].text).toBe("7");
  });

  test("fails when the parser fails", async () => {
    const { store, scan } = await setup({ "a.md": "# A" });
    const failing = { parse: () => Promise.reject(new Error("worker gone")) };

    await expect(scan({ parser: failing })).rejects.toThrow("worker gone");
    expect((await store.stamps()).size).toBe(0);
  });

  test("stops when cancelled", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 450; i++) files[`n${i}.md`] = "";
    const { store, scan } = await setup(files);
    let batches = 0;

    await scan({
      onProgress: () => batches++,
      cancelled: () => batches >= 2,
    });
    // The first batch was written, then the scan stopped.
    expect((await store.stamps()).size).toBe(200);
  });
});

describe("Vault indexing", () => {
  test("opening a vault brings its index up to date", async () => {
    const platform = createMemoryPlatform({ "/v/a.md": "# A\n[[B]]" });
    const vault = await Vault.open("/v", platform);
    await vault.indexed();
    vault.close();

    const store = await IndexStore.open(platform, "/v");
    expect(await store.outgoingLinks("a.md")).toMatchObject([{ target: "B" }]);
  });

  test("the vault opens even when the index cannot", async () => {
    const platform = createMemoryPlatform({ "/v/a.md": "# A" });
    platform.sql.open = () => Promise.reject(new Error("no cache folder"));
    const vault = await Vault.open("/v", platform);

    expect(await vault.notes.read("a.md")).toBe("# A");
    await expect(vault.indexed()).rejects.toThrow("no cache folder");
    vault.close();
  });

  test("closing the vault stops the scan and closes the index", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 450; i++) files[`/v/n${i}.md`] = "";
    const platform = createMemoryPlatform(files);
    const open = platform.sql.open.bind(platform.sql);
    let closed = 0;
    platform.sql.open = async (name) => {
      const db = await open(name);
      return {
        execute: (sql, params) => db.execute(sql, params),
        select: (sql, params) => db.select(sql, params),
        close: async () => void closed++,
      };
    };

    const vault = await Vault.open("/v", platform);
    vault.close();
    await vault.indexed();
    expect(closed).toBe(1);
  });
});
