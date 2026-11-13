import { describe, expect, test } from "bun:test";
import { Vault } from "../src/index";
import { createMemoryPlatform } from "./fakes";

/** A vault with its index caught up, and a way to read every note. */
async function openVault(files: Record<string, string>) {
  const platform = createMemoryPlatform(
    Object.fromEntries(
      Object.entries(files).map(([path, text]) => [`/v/${path}`, text]),
    ),
  );
  await platform.fs.mkdir("/v");
  const vault = await Vault.open("/v", platform, { changeDelayMs: 5 });
  await vault.indexed();
  const read = (path: string) => vault.notes.read(path);
  return { vault, read };
}

describe("renaming rewrites links", () => {
  test("in other notes, keeping headings, aliases and spelling", async () => {
    const { vault, read } = await openVault({
      "Old.md": "",
      "src.md":
        "[[Old]] [[Old#Part|text]] [[old.md]] [[ Old ]] [x](Old.md#Part) [[Other]]",
    });
    const update = await vault.notes.rename("Old.md", "New.md");

    expect(await read("src.md")).toBe(
      "[[New]] [[New#Part|text]] [[New.md]] [[ New ]] [x](New.md#Part) [[Other]]",
    );
    expect(update).toEqual({ updated: ["src.md"], failed: [] });
  });

  test("a name stays a name while it finds the note", async () => {
    const { vault, read } = await openVault({
      "Note.md": "",
      "Unique.md": "",
      "src.md": "[[Unique]] [[Note]]",
      "a/x.md": "",
    });
    await vault.notes.rename("Unique.md", "a/Unique.md");
    expect(await read("src.md")).toBe("[[Unique]] [[Note]]");
  });

  test("a name that would find another note becomes a path", async () => {
    const { vault, read } = await openVault({
      "a/b/Note.md": "",
      "x/y/Note.md": "",
      "src.md": "[[Note]] [[a/b/Note]] [[/a/b/Note]]",
    });
    await vault.folders.create("a/b/c");
    await vault.notes.rename("a/b/Note.md", "a/b/c/Note.md");
    // "Note" would now find x/y/Note.md, the shorter path.
    expect(await read("src.md")).toBe(
      "[[a/b/c/Note]] [[a/b/c/Note]] [[/a/b/c/Note]]",
    );
  });

  test("leaves links to a namesake alone", async () => {
    const { vault, read } = await openVault({
      "Note.md": "",
      "deep/Note.md": "",
      "src.md": "[[Note]]",
    });
    const update = await vault.notes.rename("deep/Note.md", "deep/Other.md");
    expect(await read("src.md")).toBe("[[Note]]");
    expect(update.updated).toEqual([]);
  });

  test("Markdown links, in their own spelling", async () => {
    const { vault, read } = await openVault({
      "My Note.md": "",
      "src.md": [
        "[a](My%20Note.md) [b](<My Note.md#Part>) [c][ref] [ref]",
        "",
        "[ref]: My%20Note.md",
      ].join("\n"),
    });
    await vault.folders.create("dir (old)");
    await vault.notes.rename("My Note.md", "dir (old)/Other Note.md");
    expect(await read("src.md")).toBe(
      [
        "[a](dir%20%28old%29/Other%20Note.md) [b](<dir (old)/Other Note.md#Part>) [c][ref] [ref]",
        "",
        "[ref]: dir%20%28old%29/Other%20Note.md",
      ].join("\n"),
    );
  });

  test("Markdown links in the moved note follow its new folder", async () => {
    const { vault, read } = await openVault({
      "a/src.md": "[up](../c.md) [here](sibling.md) [[c]] [none](gone.md)",
      "a/sibling.md": "",
      "a/b/x.md": "",
      "c.md": "",
    });
    const update = await vault.notes.rename("a/src.md", "a/b/src.md");
    expect(await read("a/b/src.md")).toBe(
      "[up](../../c.md) [here](../sibling.md) [[c]] [none](gone.md)",
    );
    expect(update.updated).toEqual(["a/b/src.md"]);
  });

  test("links of a note to itself", async () => {
    const { vault, read } = await openVault({
      "Old.md": "[[Old]] [[#Part]] [me](Old.md)",
    });
    await vault.notes.rename("Old.md", "New.md");
    expect(await read("New.md")).toBe("[[New]] [[#Part]] [me](New.md)");
  });

  test("a change of case alone", async () => {
    const { vault, read } = await openVault({
      "note.md": "",
      "src.md": "[[note]]",
    });
    await vault.notes.rename("note.md", "Note.md");
    expect(await read("src.md")).toBe("[[Note]]");
  });

  test("to every note inside a renamed folder", async () => {
    const { vault, read } = await openVault({
      "projects/Carbon.md": "[b](sub/b.md) [[projects/sub/b]]",
      "projects/sub/b.md": "[up](../Carbon.md)",
      "src.md": "[[projects/Carbon]] [[Carbon]] [x](projects/sub/b.md)",
    });
    const update = await vault.folders.rename("projects", "work");

    expect(await read("src.md")).toBe(
      "[[work/Carbon]] [[Carbon]] [x](work/sub/b.md)",
    );
    // Links between notes that moved together stay as they were.
    expect(await read("work/sub/b.md")).toBe("[up](../Carbon.md)");
    expect(await read("work/Carbon.md")).toBe("[b](sub/b.md) [[work/sub/b]]");
    expect(update.updated.sort()).toEqual(["src.md", "work/Carbon.md"]);
  });

  test("the index follows the rewritten notes", async () => {
    const { vault } = await openVault({ "Old.md": "", "src.md": "[[Old]]" });
    await vault.notes.rename("Old.md", "New.md");
    await vault.indexed();
    const backlinks = await vault.links.backlinks("New.md");
    expect(backlinks.map((b) => b.snippet)).toEqual(["New"]);
  });

  test("nothing for a file that is not a note", async () => {
    const { vault, read } = await openVault({
      "pic.png": "",
      "src.md": "![](pic.png) [[pic.png]]",
    });
    const update = await vault.notes.rename("pic.png", "img.png");
    expect(update).toEqual({ updated: [], failed: [] });
    expect(await read("src.md")).toBe("![](pic.png) [[pic.png]]");
  });

  test("a note changed meanwhile is reported, not overwritten", async () => {
    const { vault, read } = await openVault({
      "Old.md": "",
      "src.md": "[[Old]]",
    });
    // A write that lands between finding the links and writing them.
    const write = vault.notes.write.bind(vault.notes);
    let first = true;
    vault.notes.write = async (path, text, base) => {
      if (first && path === "src.md") {
        first = false;
        await write(path, "edited", base);
      }
      return write(path, text, base);
    };
    const update = await vault.notes.rename("Old.md", "New.md");
    expect(update).toEqual({ updated: [], failed: ["src.md"] });
    expect(await read("src.md")).toBe("edited");
  });
});
