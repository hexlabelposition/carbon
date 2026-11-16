import { describe, expect, test } from "bun:test";
import { Vault } from "../src/index";
import { renameTagIn } from "../src/tags/rename";
import { createMemoryPlatform } from "./fakes";

describe("renameTagIn", () => {
  test("renames inline tags and the ones nested in them", () => {
    expect(
      renameTagIn(
        "#area and #Area/x/y, not #areas or #b/area",
        "area",
        "field",
      ),
    ).toBe("#field and #field/x/y, not #areas or #b/area");
  });

  test("renames a nested tag, keeping what follows", () => {
    expect(renameTagIn("#a/b #a/b/c #a/bc", "A/B", "z")).toBe("#z #z/c #a/bc");
    expect(renameTagIn("#a/b/c", "a/b", "x/y")).toBe("#x/y/c");
  });

  test("leaves code, links and headings alone", () => {
    const text = "`#a` [x](https://e.org/#a) [[#a]]\n\n#a";
    expect(renameTagIn(text, "a", "b")).toBe(
      "`#a` [x](https://e.org/#a) [[#a]]\n\n#b",
    );
  });

  test("renames the tags of the frontmatter as written", () => {
    expect(
      renameTagIn(
        "---\ntitle: a\ntags: [a, '#a/x', other, 2026]\n---\n#a",
        "a",
        "b",
      ),
    ).toBe("---\ntitle: a\ntags: [b, '#b/x', other, 2026]\n---\n#b");
    expect(renameTagIn('---\ntags: "a, #a/x  c"\n---\n', "a", "b")).toBe(
      '---\ntags: "b, #b/x  c"\n---\n',
    );
    expect(renameTagIn("---\ntags:\n  - x\n  - A\n---\n", "a", "b")).toBe(
      "---\ntags:\n  - x\n  - b\n---\n",
    );
  });

  test("is null for a note without the tag", () => {
    expect(renameTagIn("---\ntags: [x]\n---\n#y #ab", "a", "b")).toBeNull();
    expect(renameTagIn("---\nother: a\n---\n", "a", "b")).toBeNull();
  });
});

describe("vault.tags.rename", () => {
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

  test("rewrites every note with the tag, and the index follows", async () => {
    const vault = await openVault({
      "a.md": "#idea here",
      "b.md": "---\ntags: [idea/x]\n---\nbody",
      "c.md": "#other",
    });
    expect(await vault.tags.rename("#idea", "thought")).toEqual({
      updated: ["a.md", "b.md"],
      failed: [],
    });
    expect(await vault.notes.read("a.md")).toBe("#thought here");
    expect(await vault.notes.read("b.md")).toBe(
      "---\ntags: [thought/x]\n---\nbody",
    );
    await vault.indexed();
    expect((await vault.tags.all()).map((t) => t.tag)).toEqual([
      "other",
      "thought",
      "thought/x",
    ]);
    vault.close();
  });

  test("changes only the case of a tag", async () => {
    const vault = await openVault({ "a.md": "#work" });
    await vault.tags.rename("work", "Work");
    expect(await vault.notes.read("a.md")).toBe("#Work");
    vault.close();
  });

  test("rejects a name that cannot be a tag", async () => {
    const vault = await openVault({ "a.md": "#a" });
    for (const name of ["", "two words", "2026", "a//b"]) {
      await expect(vault.tags.rename("a", name)).rejects.toThrow("Not a tag");
    }
    expect(await vault.notes.read("a.md")).toBe("#a");
    vault.close();
  });
});
