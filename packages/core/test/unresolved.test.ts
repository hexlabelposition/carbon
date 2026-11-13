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

/** Each missing note with the places it is linked from. */
const summary = async (store: IndexStore) =>
  (await store.unresolved()).map(({ path, links }) => [
    path,
    links.map((link) => `${link.source}@${link.start}`),
  ]);

describe("unresolved links", () => {
  test("every link that finds no note, with its context", async () => {
    const text = "See [[Missing|it]] and [[Here]].";
    const store = await openStore(note("Here.md"), note("dir/src.md", text));
    expect(await store.unresolved()).toEqual([
      {
        path: "Missing.md",
        links: [
          {
            source: "dir/src.md",
            sourceTitle: "src",
            snippet: "See it and Here.",
            start: 4,
            end: 18,
          },
        ],
      },
    ]);
  });

  test("grouped by the note they miss, whatever the spelling", async () => {
    const store = await openStore(
      note("b.md", "[[missing#Part]] [[Other/Note]]"),
      note("a.md", "[[Missing]] [m](Missing.md)"),
      note("Other/src.md", "[n](Note.md)"),
    );
    expect(await summary(store)).toEqual([
      ["Missing.md", ["a.md@0", "a.md@12", "b.md@0"]],
      ["Other/Note.md", ["Other/src.md@0", "b.md@17"]],
    ]);
  });

  test("a Markdown link misses the note at its path", async () => {
    const store = await openStore(
      note("a/b/src.md", "[x](../c%20d.md) [y](/top.md) [z](../../../out.md)"),
    );
    // Above the vault root, no note can be found: not in the list.
    expect((await store.unresolved()).map((t) => t.path)).toEqual([
      "a/c d.md",
      "top.md",
    ]);
  });

  test("leave the list when the note appears", async () => {
    const store = await openStore(note("src.md", "[[Later]] [[Never]]"));
    await store.replaceNotes([note("dir/Later.md")]);
    expect((await store.unresolved()).map((t) => t.path)).toEqual(["Never.md"]);
    await store.removeNotes(["dir/Later.md"]);
    expect((await store.unresolved()).map((t) => t.path)).toEqual([
      "Later.md",
      "Never.md",
    ]);
  });

  test("none in a vault where every link finds its note", async () => {
    const store = await openStore(
      note("a.md", "[[b]] [[#Part]]"),
      note("b.md"),
    );
    expect(await store.unresolved()).toEqual([]);
  });

  test("through vault.links.unresolved", async () => {
    const platform = createMemoryPlatform({ "/v/a.md": "[[Ghost]]" });
    await platform.fs.mkdir("/v");
    const vault = await Vault.open("/v", platform, { changeDelayMs: 5 });
    await vault.indexed();
    expect((await vault.links.unresolved()).map((t) => t.path)).toEqual([
      "Ghost.md",
    ]);
    vault.close();
  });
});
