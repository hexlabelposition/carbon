import { describe, expect, test } from "bun:test";
import { Vault } from "../src/index";
import { createMemoryPlatform } from "./fakes";

async function openVault(files: Record<string, string>) {
  const platform = createMemoryPlatform(
    Object.fromEntries(
      Object.entries(files).map(([path, text]) => [`/v/${path}`, text]),
    ),
  );
  await platform.fs.mkdir("/v");
  const vault = await Vault.open("/v", platform, { changeDelayMs: 5 });
  return { vault, platform };
}

const wiki = (target: string) => ({ kind: "wiki" as const, target });

describe("vault.links.follow", () => {
  test("opens the note a link points to", async () => {
    const { vault } = await openVault({ "dir/Note.md": "x", "src.md": "" });
    expect(await vault.links.follow("src.md", wiki("note"))).toEqual({
      path: "dir/Note.md",
      created: false,
    });
    vault.close();
  });

  test("creates a missing note by name at the vault root", async () => {
    const { vault } = await openVault({ "a/src.md": "" });
    expect(await vault.links.follow("a/src.md", wiki("Idea"))).toEqual({
      path: "Idea.md",
      created: true,
    });
    expect(await vault.notes.read("Idea.md")).toBe("");
    // The link finds it from now on.
    expect(await vault.links.follow("a/src.md", wiki("idea"))).toEqual({
      path: "Idea.md",
      created: false,
    });
    vault.close();
  });

  test("creates a note by path, with its folders", async () => {
    const { vault } = await openVault({ "a/b/src.md": "" });
    expect(
      await vault.links.follow("a/b/src.md", wiki("projects/New Idea")),
    ).toEqual({ path: "projects/New Idea.md", created: true });
    expect(
      await vault.links.follow("a/b/src.md", {
        kind: "markdown",
        target: "../Up.md",
      }),
    ).toEqual({ path: "a/Up.md", created: true });
    expect(await vault.notes.read("projects/New Idea.md")).toBe("");
    expect(await vault.notes.read("a/Up.md")).toBe("");
    vault.close();
  });

  test("nothing for a link no note can have", async () => {
    const { vault, platform } = await openVault({ "src.md": "" });
    expect(
      await vault.links.follow("src.md", {
        kind: "markdown",
        target: "../out.md",
      }),
    ).toBeNull();
    expect(await platform.fs.exists("/out.md")).toBe(false);
    vault.close();
  });

  test("rejects a name a new note cannot have", async () => {
    const { vault, platform } = await openVault({ "src.md": "" });
    await expect(vault.links.follow("src.md", wiki(".hidden"))).rejects.toThrow(
      "Hidden names",
    );
    expect(await platform.fs.exists("/v/.hidden.md")).toBe(false);
    vault.close();
  });

  test("takes a note that someone made in the meantime", async () => {
    const { vault } = await openVault({ "src.md": "" });
    const create = vault.notes.create.bind(vault.notes);
    vault.notes.create = async (path, content) => {
      await create(path, "theirs");
      return create(path, content);
    };
    expect(await vault.links.follow("src.md", wiki("Race"))).toEqual({
      path: "Race.md",
      created: false,
    });
    expect(await vault.notes.read("Race.md")).toBe("theirs");
    vault.close();
  });
});

describe("vault.links.headings", () => {
  test("the headings of a note, for links to them", async () => {
    const { vault } = await openVault({
      "Note.md": "# One\n\ntext\n\n## Two *b*",
    });
    await vault.indexed();
    expect(await vault.links.headings("Note.md")).toEqual([
      { level: 1, text: "One", pos: 0 },
      { level: 2, text: "Two b", pos: 13 },
    ]);
    expect(await vault.links.headings("Missing.md")).toEqual([]);
    vault.close();
  });
});
