import { describe, expect, test } from "bun:test";
import { IndexStore, parseNote, Vault, type IndexEntry } from "../src/index";
import { linkKeys, linkPath, NoteFinder } from "../src/links/resolve";
import { createMemoryPlatform } from "./fakes";

/** A note as the indexer would hand it over; aliases are not parsed yet. */
const note = (path: string, text = "", aliases: string[] = []): IndexEntry => ({
  note: { ...parseNote(path, text), aliases },
  stamp: { mtime: 1, size: text.length, hash: "h" },
});

async function openStore(...entries: IndexEntry[]) {
  const store = await IndexStore.open(createMemoryPlatform(), "/v");
  await store.replaceNotes(entries);
  /** Where each link of the note at `path` points, in order. */
  const targets = async (path: string) =>
    (await store.outgoingLinks(path)).map((link) => link.resolved);
  return { store, targets };
}

describe("link resolution", () => {
  describe("keys", () => {
    const wiki = (target: string, source = "dir/src.md") =>
      linkKeys(source, { kind: "wiki", target });
    const markdown = (target: string, source = "a/b/src.md") =>
      linkKeys(source, { kind: "markdown", target });

    test("a wiki link names a note from the vault root, or by file name", () => {
      expect(wiki("Note")).toEqual({ path: "note.md", name: "note" });
      expect(wiki("Note.MD")).toEqual({ path: "note.md", name: "note" });
      expect(wiki("Projects/Carbon")).toEqual({
        path: "projects/carbon.md",
        name: null,
      });
      expect(wiki("/Projects/Carbon")).toEqual(wiki("Projects/Carbon"));
    });

    test("a wiki link to a heading only points into its own note", () => {
      expect(wiki("")).toEqual({ path: "dir/src.md", name: null });
    });

    test("a Markdown link is a path relative to its note", () => {
      expect(markdown("c.md")).toEqual({ path: "a/b/c.md", name: null });
      expect(markdown("./x/../c.md")).toEqual({ path: "a/b/c.md", name: null });
      expect(markdown("../../c.md")).toEqual({ path: "c.md", name: null });
      expect(markdown("/top/c.md")).toEqual({ path: "top/c.md", name: null });
      expect(markdown("../../../c.md")).toEqual({ path: null, name: null });
    });

    test("the path a link misses keeps its spelling", () => {
      expect(
        linkPath("dir/src.md", { kind: "wiki", target: "/New Note" }),
      ).toBe("New Note.md");
      expect(linkPath("dir/src.md", { kind: "wiki", target: "" })).toBe(
        "dir/src.md",
      );
      expect(
        linkPath("a/src.md", { kind: "markdown", target: "../B.MD" }),
      ).toBe("B.MD");
      expect(linkPath("src.md", { kind: "markdown", target: "../x.md" })).toBe(
        null,
      );
    });

    test("ignore case and Unicode form", () => {
      const decomposed = "Café".normalize("NFD");
      expect(wiki(decomposed)).toEqual(wiki("CAFÉ"));
      expect(wiki("ЗАМЕТКА").name).toBe("заметка");
    });
  });

  describe("in the index", () => {
    test("an exact path comes first", async () => {
      const { targets } = await openStore(
        note("src.md", "[[Note]] [[a/Note]]"),
        note("Note.md"),
        note("a/Note.md"),
      );
      expect(await targets("src.md")).toEqual(["Note.md", "a/Note.md"]);
    });

    test("then the file name anywhere, the shortest path first", async () => {
      const { targets } = await openStore(
        note("src.md", "[[Note]] [[Twin]]"),
        note("deep/er/Note.md"),
        note("b/Note.md"),
        note("y/Twin.md"),
        note("x/Twin.md"),
      );
      expect(await targets("src.md")).toEqual(["b/Note.md", "x/Twin.md"]);
    });

    test("then an alias, after every file name", async () => {
      const { targets } = await openStore(
        note("src.md", "[[Nick]] [[Note]]"),
        note("people/Someone.md", "", ["Nick"]),
        note("Other.md", "", ["Note"]),
        note("far/away/Note.md"),
      );
      expect(await targets("src.md")).toEqual([
        "people/Someone.md",
        "far/away/Note.md",
      ]);
    });

    test("ignores case, in any language", async () => {
      const { targets } = await openStore(
        note("src.md", "[[заметка]] [[NOTE]] [[Café]]"),
        note("Заметка.md"),
        note("dir/note.md"),
        note("Café.md"),
      );
      expect(await targets("src.md")).toEqual([
        "Заметка.md",
        "dir/note.md",
        "Café.md",
      ]);
    });

    test("a folder in a wiki link must match from the root", async () => {
      const { targets } = await openStore(
        note("src.md", "[[x/Note]]"),
        note("y/x/Note.md"),
      );
      expect(await targets("src.md")).toEqual([null]);
    });

    test("a Markdown link only matches its path", async () => {
      const { targets } = await openStore(
        note("a/b/src.md", "[up](../c.md) [here](Note.md) [far](d/e.md)"),
        note("a/c.md"),
        note("Note.md"),
        note("a/b/d/e.md"),
      );
      expect(await targets("a/b/src.md")).toEqual([
        "a/c.md",
        null,
        "a/b/d/e.md",
      ]);
    });

    test("a link to a heading of the same note points to it", async () => {
      const { targets } = await openStore(note("src.md", "[[#Part]]"));
      expect(await targets("src.md")).toEqual(["src.md"]);
    });

    test("a link to a note that does not exist is unresolved", async () => {
      const { targets } = await openStore(note("src.md", "[[Missing]]"));
      expect(await targets("src.md")).toEqual([null]);
    });
  });

  describe("as notes come and go", () => {
    test("a new note takes the links that were waiting for it", async () => {
      const { store, targets } = await openStore(note("src.md", "[[Later]]"));
      await store.replaceNotes([note("dir/Later.md")]);
      expect(await targets("src.md")).toEqual(["dir/Later.md"]);
    });

    test("a note with a shorter path takes the links over", async () => {
      const { store, targets } = await openStore(
        note("src.md", "[[Note]]"),
        note("deep/Note.md"),
      );
      await store.replaceNotes([note("a/Note.md")]);
      expect(await targets("src.md")).toEqual(["a/Note.md"]);
    });

    test("links to a removed note fall to the next match, or to none", async () => {
      const { store, targets } = await openStore(
        note("src.md", "[[Note]] [[Only]]"),
        note("Note.md"),
        note("dir/Note.md"),
        note("Only.md"),
      );
      await store.removeNotes(["Note.md", "Only.md"]);
      expect(await targets("src.md")).toEqual(["dir/Note.md", null]);
    });

    test("a renamed note loses the links to its old name", async () => {
      const { store, targets } = await openStore(
        note("src.md", "[[Old]] [[New]]"),
        note("Old.md"),
      );
      await store.removeNotes(["Old.md"]);
      await store.replaceNotes([note("New.md")]);
      expect(await targets("src.md")).toEqual([null, "New.md"]);
    });

    test("an alias that is gone lets its links go", async () => {
      const { store, targets } = await openStore(
        note("src.md", "[[Nick]] [[Name]]"),
        note("Someone.md", "", ["Nick"]),
      );
      await store.replaceNotes([note("Someone.md", "", ["Name"])]);
      expect(await targets("src.md")).toEqual([null, "Someone.md"]);
    });

    test("a note indexed again resolves its own links again", async () => {
      const { store, targets } = await openStore(
        note("src.md", "[[A]]"),
        note("A.md"),
        note("B.md"),
      );
      await store.replaceNotes([note("src.md", "[[B]] [[A]]")]);
      expect(await targets("src.md")).toEqual(["B.md", "A.md"]);
    });

    test("links across batches of a whole vault", async () => {
      // More notes than one query takes: links point into later chunks.
      const { targets } = await openStore(
        ...Array.from({ length: 1200 }, (_, i) =>
          note(`n${i}.md`, `[[n${i + 700}]]`),
        ),
      );
      expect(await targets("n0.md")).toEqual(["n700.md"]);
      expect(await targets("n499.md")).toEqual(["n1199.md"]);
      expect(await targets("n500.md")).toEqual([null]);
    });
  });

  test("resolves a link that is not indexed", async () => {
    const { store } = await openStore(note("dir/Note.md"), note("a/b.md"));
    expect(await store.resolve("x.md", { kind: "wiki", target: "note" })).toBe(
      "dir/Note.md",
    );
    expect(
      await store.resolve("a/x.md", { kind: "markdown", target: "b.md" }),
    ).toBe("a/b.md");
    expect(
      await store.resolve("x.md", { kind: "wiki", target: "Nothing" }),
    ).toBeNull();
  });
});

describe("NoteFinder", () => {
  /** Resolves `[[target]]`, written in `src.md`, among `paths`. */
  const find = (paths: string[], target: string) =>
    new NoteFinder(paths).find(linkKeys("src.md", { kind: "wiki", target }));

  test("finds as the index does: path, then the shortest file name", () => {
    expect(find(["a/Note.md", "Note.md"], "Note")).toBe("Note.md");
    expect(find(["a/Note.md", "Note.md"], "a/Note")).toBe("a/Note.md");
    expect(find(["deep/er/Note.md", "b/Note.md"], "note")).toBe("b/Note.md");
    expect(find(["y/Twin.md", "x/Twin.md"], "Twin")).toBe("x/Twin.md");
    expect(find(["y/x/Note.md"], "x/Note")).toBeNull();
    expect(find(["Note.md"], "Other")).toBeNull();
  });

  test("agrees with the index on the same vault", async () => {
    const paths = ["Note.md", "a/Note.md", "b/c/Note.md", "Café.md", "z/x.md"];
    const targets = ["Note", "a/Note", "c/Note", "CAFÉ", "x", "z/x", "none"];
    const { store } = await openStore(
      ...paths.map((path) => note(path)),
      note("src.md", targets.map((t) => `[[${t}]]`).join(" ")),
    );
    const indexed = (await store.outgoingLinks("src.md")).map(
      (link) => link.resolved,
    );
    expect(targets.map((t) => find([...paths, "src.md"], t))).toEqual(indexed);
  });
});

describe("vault.links.resolve", () => {
  test("waits for the index, so a note just written is found", async () => {
    const platform = createMemoryPlatform({ "/v/a/src.md": "" });
    await platform.fs.mkdir("/v");
    const vault = await Vault.open("/v", platform, { changeDelayMs: 5 });
    await vault.notes.write("a/New.md", "", null);
    // No `indexed()` in between: the write is not in the index yet.
    expect(
      await vault.links.resolve("a/src.md", { kind: "wiki", target: "new" }),
    ).toBe("a/New.md");
    expect(
      await vault.links.resolve("a/src.md", {
        kind: "markdown",
        target: "New.md",
      }),
    ).toBe("a/New.md");
    expect(
      await vault.links.resolve("a/src.md", { kind: "wiki", target: "None" }),
    ).toBeNull();
    vault.close();
  });
});
