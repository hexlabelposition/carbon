import { describe, expect, test } from "bun:test";
import { IndexStore, parseNote, Vault, type IndexEntry } from "../src/index";
import { createMemoryPlatform } from "./fakes";

const note = (path: string, text = ""): IndexEntry => ({
  note: parseNote(path, text),
  stamp: { mtime: 1, size: text.length, hash: "h" },
});

async function openStore(...entries: IndexEntry[]) {
  const store = await IndexStore.open(createMemoryPlatform(), "/v");
  await store.replaceNotes(entries);
  return store;
}

describe("backlinks", () => {
  describe("in the index", () => {
    test("every link that resolves to the note, with its context", async () => {
      const text = "Intro\n\nSee [[Target|the target]] here.";
      const store = await openStore(
        note("Target.md"),
        note("dir/Source.md", text),
      );
      const start = text.indexOf("[[");
      expect(await store.backlinks("Target.md")).toEqual([
        {
          source: "dir/Source.md",
          sourceTitle: "Source",
          snippet: "See the target here.",
          start,
          end: text.indexOf("]]") + 2,
        },
      ]);
    });

    test("by path, then in the order they are written", async () => {
      const store = await openStore(
        note("T.md"),
        note("b.md", "[[T]] and [t](T.md)"),
        note("a.md", "[[T#Part]]"),
      );
      const found = await store.backlinks("T.md");
      expect(found.map((b) => [b.source, b.start])).toEqual([
        ["a.md", 0],
        ["b.md", 0],
        ["b.md", 10],
      ]);
    });

    test("only links that resolve to the note, not to a namesake", async () => {
      const store = await openStore(
        note("Note.md"),
        note("deep/Note.md"),
        note("src.md", "[[Note]] [[deep/Note]]"),
      );
      expect((await store.backlinks("Note.md")).map((b) => b.start)).toEqual([
        0,
      ]);
      expect(
        (await store.backlinks("deep/Note.md")).map((b) => b.start),
      ).toEqual([9]);
    });

    test("a note is not its own backlink", async () => {
      const store = await openStore(note("Self.md", "[[#Part]] [[Self]]"));
      expect(await store.backlinks("Self.md")).toEqual([]);
    });

    test("follow the notes as they change", async () => {
      const store = await openStore(note("T.md"), note("src.md", "[[T]]"));
      await store.replaceNotes([note("src.md", "no link")]);
      expect(await store.backlinks("T.md")).toEqual([]);

      await store.replaceNotes([note("other.md", "[[T]]")]);
      await store.removeNotes(["T.md"]);
      expect(await store.backlinks("T.md")).toEqual([]);
    });

    test("none for a note that is not indexed", async () => {
      const store = await openStore(note("src.md", "[[Missing]]"));
      expect(await store.backlinks("Missing.md")).toEqual([]);
    });
  });

  describe("vault.links.backlinks", () => {
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

    test("answers from the index, and sees notes saved since", async () => {
      const vault = await openVault({
        "Target.md": "",
        "a.md": "Link to [[Target]].",
      });
      const sources = async () =>
        (await vault.links.backlinks("Target.md")).map((b) => b.source);
      expect(await sources()).toEqual(["a.md"]);

      await vault.notes.write("b.md", "Also [[Target]].", null);
      await vault.indexed();
      expect(await sources()).toEqual(["a.md", "b.md"]);
      vault.close();
    });

    test("rejects after the vault is closed", async () => {
      const vault = await openVault({});
      vault.close();
      await expect(vault.links.backlinks("a.md")).rejects.toThrow(
        "The index is not open",
      );
    });
  });
});
