import { describe, expect, test } from "bun:test";
import type { FsEvent, ParsedNote } from "../src/index";
import { MemoryFileSystem, MemoryIndexStore, MemoryWatcher } from "./fakes";

describe("MemoryFileSystem", () => {
  test("lists direct children, folders included", async () => {
    const fs = new MemoryFileSystem({
      "/v/a.md": "",
      "/v/sub/b.md": "",
      "/v/sub/deep/c.md": "",
    });
    expect(await fs.list("/v")).toEqual([
      { name: "a.md", kind: "file" },
      { name: "sub", kind: "dir" },
    ]);
  });

  test("stat reports kind, byte size and a growing mtime", async () => {
    const fs = new MemoryFileSystem({ "/v/a.md": "привет" });
    const before = await fs.stat("/v/a.md");
    expect(before).toMatchObject({ kind: "file", size: 12 });
    await fs.writeTextAtomic("/v/a.md", "x");
    expect((await fs.stat("/v/a.md")).mtime).toBeGreaterThan(before.mtime);
    expect((await fs.stat("/v")).kind).toBe("dir");
  });

  test("write needs an existing parent folder", async () => {
    const fs = new MemoryFileSystem({ "/v/a.md": "" });
    await expect(fs.writeTextAtomic("/v/new/b.md", "")).rejects.toThrow(
      "ENOENT",
    );
    await fs.mkdir("/v/new");
    await fs.writeTextAtomic("/v/new/b.md", "b");
    expect(await fs.readText("/v/new/b.md")).toBe("b");
  });

  test("rename moves a folder with everything inside", async () => {
    const fs = new MemoryFileSystem({
      "/v/old/a.md": "a",
      "/v/old/deep/b.md": "b",
      "/v/older.md": "",
    });
    await fs.rename("/v/old", "/v/new");
    expect(await fs.readText("/v/new/deep/b.md")).toBe("b");
    await expect(fs.readText("/v/old/a.md")).rejects.toThrow("ENOENT");
    expect(await fs.readText("/v/older.md")).toBe("");
  });

  test("remove deletes files and only empty folders", async () => {
    const fs = new MemoryFileSystem({ "/v/sub/a.md": "" });
    await expect(fs.remove("/v/sub")).rejects.toThrow("ENOTEMPTY");
    await fs.remove("/v/sub/a.md");
    await fs.remove("/v/sub");
    expect(await fs.list("/v")).toEqual([]);
  });

  test("recursive remove deletes a folder with everything inside", async () => {
    const fs = new MemoryFileSystem({
      "/v/sub/a.md": "",
      "/v/sub/deep/b.md": "",
      "/v/subway.md": "",
    });
    await fs.remove("/v/sub", { recursive: true });
    expect(await fs.exists("/v/sub/deep/b.md")).toBe(false);
    expect(await fs.exists("/v/sub")).toBe(false);
    expect(await fs.exists("/v/subway.md")).toBe(true);
  });

  test("mkdir creates missing parents and accepts an existing folder", async () => {
    const fs = new MemoryFileSystem();
    await fs.mkdir("/v/a/b");
    await fs.mkdir("/v/a");
    expect(await fs.list("/v/a")).toEqual([{ name: "b", kind: "dir" }]);
  });
});

describe("MemoryWatcher", () => {
  test("delivers events under the watched folder until unwatched", async () => {
    const watcher = new MemoryWatcher();
    const seen: FsEvent[] = [];
    const unwatch = await watcher.watch("/v", (e) => seen.push(e));

    watcher.emit({ kind: "modified", path: "/v/a.md" });
    watcher.emit({ kind: "modified", path: "/vault2/a.md" });
    unwatch();
    watcher.emit({ kind: "removed", path: "/v/a.md" });

    expect(seen).toEqual([{ kind: "modified", path: "/v/a.md" }]);
    expect(watcher.watchCount).toBe(0);
  });
});

describe("MemoryIndexStore", () => {
  const note = (path: string, extra: Partial<ParsedNote> = {}): ParsedNote => ({
    path,
    title: path.replace(/\.md$/, ""),
    headings: [],
    links: [],
    tags: [],
    aliases: [],
    properties: {},
    plainText: "",
    ...extra,
  });

  test("finds backlinks and forgets removed notes", async () => {
    const index = new MemoryIndexStore();
    const link = {
      target: "Inbox",
      alias: null,
      fragment: null,
      start: 4,
      end: 13,
    };
    await index.replaceNote(note("Inbox.md"));
    await index.replaceNote(note("Carbon.md", { links: [link] }));

    expect(await index.backlinks("Inbox.md")).toEqual([
      {
        source: "Carbon.md",
        sourceTitle: "Carbon",
        snippet: "",
        start: 4,
        end: 13,
      },
    ]);
    await index.removeNote("Carbon.md");
    expect(await index.backlinks("Inbox.md")).toEqual([]);
  });

  test("search ranks title matches first and respects the limit", async () => {
    const index = new MemoryIndexStore();
    await index.replaceNote(
      note("Log.md", { plainText: "Notes about the index cache" }),
    );
    await index.replaceNote(note("Index.md", { plainText: "Nothing here" }));

    const hits = await index.search("INDEX", 10);
    expect(hits.map((h) => h.path)).toEqual(["Index.md", "Log.md"]);
    expect(hits[1].snippet).toContain("index cache");
    expect(await index.search("index", 1)).toHaveLength(1);
    expect(await index.search("", 10)).toEqual([]);
  });
});
