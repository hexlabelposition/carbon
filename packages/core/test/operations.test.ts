import { describe, expect, test } from "bun:test";
import { Vault, type TreeNode } from "../src/index";
import { createMemoryPlatform } from "./fakes";

async function openVault() {
  const platform = createMemoryPlatform({
    "/vault/Inbox.md": "# Inbox",
    "/vault/projects/Carbon.md": "carbon",
    "/vault/projects/archive/Old.md": "old",
    "/vault/projects.md": "not the folder",
    "/outside/secret.md": "secret",
  });
  const vault = await Vault.open("/vault", platform);
  return { vault, fs: platform.fs };
}

/** Every path in the tree, folders with a trailing slash. */
async function paths(vault: Vault): Promise<string[]> {
  const walk = (nodes: TreeNode[]): string[] =>
    nodes.flatMap((n) =>
      n.kind === "folder" ? [`${n.path}/`, ...walk(n.children)] : [n.path],
    );
  return walk(await vault.tree());
}

describe("vault.notes.create", () => {
  test("creates an empty note by default", async () => {
    const { vault } = await openVault();
    await vault.notes.create("New.md");
    expect(await vault.notes.read("New.md")).toBe("");
  });

  test("creates a note with content and missing folders", async () => {
    const { vault } = await openVault();
    await vault.notes.create("areas/health/Sleep.md", "# Sleep");
    expect(await vault.notes.read("areas/health/Sleep.md")).toBe("# Sleep");
    expect(await paths(vault)).toContain("areas/health/");
  });

  test("rejects when a note or folder is already there", async () => {
    const { vault } = await openVault();
    await expect(vault.notes.create("Inbox.md", "x")).rejects.toThrow(
      "Already exists",
    );
    await expect(vault.notes.create("projects")).rejects.toThrow(
      "Already exists",
    );
    expect(await vault.notes.read("Inbox.md")).toBe("# Inbox");
  });

  test.each([".hidden.md", ".carbon/x.md", "a/.b/c.md"])(
    "rejects the hidden path %p",
    async (path) => {
      const { vault } = await openVault();
      await expect(vault.notes.create(path)).rejects.toThrow("Hidden names");
    },
  );

  test("rejects a path outside the vault", async () => {
    const { vault, fs } = await openVault();
    await expect(vault.notes.create("../outside/new.md")).rejects.toThrow(
      "Invalid vault path",
    );
    expect(await fs.exists("/outside/new.md")).toBe(false);
  });
});

describe("vault.notes.rename", () => {
  test("renames a note in place", async () => {
    const { vault } = await openVault();
    await vault.notes.rename("Inbox.md", "Today.md");
    expect(await vault.notes.read("Today.md")).toBe("# Inbox");
    expect(await paths(vault)).not.toContain("Inbox.md");
  });

  test("moves a note to another folder", async () => {
    const { vault } = await openVault();
    await vault.notes.rename("Inbox.md", "projects/archive/Inbox.md");
    expect(await vault.notes.read("projects/archive/Inbox.md")).toBe("# Inbox");
  });

  test("never overwrites an existing note", async () => {
    const { vault } = await openVault();
    await expect(
      vault.notes.rename("Inbox.md", "projects/Carbon.md"),
    ).rejects.toThrow("Already exists");
    expect(await vault.notes.read("projects/Carbon.md")).toBe("carbon");
    expect(await vault.notes.read("Inbox.md")).toBe("# Inbox");
  });

  test("allows a change of case only", async () => {
    const { vault } = await openVault();
    await vault.notes.rename("Inbox.md", "INBOX.md");
    expect(await paths(vault)).toContain("INBOX.md");
  });

  test("renaming a note to itself does nothing", async () => {
    const { vault } = await openVault();
    await vault.notes.rename("Inbox.md", "Inbox.md");
    expect(await vault.notes.read("Inbox.md")).toBe("# Inbox");
  });

  test("rejects a missing note, a missing target folder and a folder", async () => {
    const { vault } = await openVault();
    await expect(vault.notes.rename("Nope.md", "X.md")).rejects.toThrow(
      "ENOENT",
    );
    await expect(
      vault.notes.rename("Inbox.md", "missing/Inbox.md"),
    ).rejects.toThrow("ENOENT");
    await expect(vault.notes.rename("projects", "p2")).rejects.toThrow(
      "Not a file",
    );
    expect(await vault.notes.read("Inbox.md")).toBe("# Inbox");
  });

  test("rejects a hidden target and a target outside the vault", async () => {
    const { vault, fs } = await openVault();
    await expect(vault.notes.rename("Inbox.md", ".Inbox.md")).rejects.toThrow(
      "Hidden names",
    );
    await expect(
      vault.notes.rename("Inbox.md", "../outside/secret.md"),
    ).rejects.toThrow("Invalid vault path");
    expect(await fs.readText("/outside/secret.md")).toBe("secret");
  });
});

describe("vault.notes.remove", () => {
  test("deletes a note", async () => {
    const { vault } = await openVault();
    await vault.notes.remove("projects/Carbon.md");
    expect(await paths(vault)).not.toContain("projects/Carbon.md");
  });

  test("rejects a missing note and refuses to delete a folder", async () => {
    const { vault } = await openVault();
    await expect(vault.notes.remove("Nope.md")).rejects.toThrow("ENOENT");
    await expect(vault.notes.remove("projects")).rejects.toThrow("Not a file");
    expect(await vault.notes.read("projects/Carbon.md")).toBe("carbon");
  });
});

describe("vault.folders", () => {
  test("creates a folder with missing parents", async () => {
    const { vault } = await openVault();
    await vault.folders.create("areas/health");
    expect(await paths(vault)).toContain("areas/health/");
  });

  test("create rejects when a folder or note is already there", async () => {
    const { vault } = await openVault();
    await expect(vault.folders.create("projects")).rejects.toThrow(
      "Already exists",
    );
    await expect(vault.folders.create("Inbox.md")).rejects.toThrow(
      "Already exists",
    );
    await expect(vault.folders.create(".hidden")).rejects.toThrow(
      "Hidden names",
    );
  });

  test("renames a folder with everything inside", async () => {
    const { vault } = await openVault();
    await vault.folders.rename("projects", "work");
    expect(await vault.notes.read("work/archive/Old.md")).toBe("old");
    // A note whose name only starts like the folder is not touched.
    expect(await vault.notes.read("projects.md")).toBe("not the folder");
    expect(await paths(vault)).not.toContain("projects/");
  });

  test("moves a folder into another folder", async () => {
    const { vault } = await openVault();
    await vault.folders.create("areas");
    await vault.folders.rename("projects/archive", "areas/archive");
    expect(await vault.notes.read("areas/archive/Old.md")).toBe("old");
  });

  test("rename rejects a move into itself, a taken target and a note", async () => {
    const { vault } = await openVault();
    await expect(
      vault.folders.rename("projects", "projects/archive/projects"),
    ).rejects.toThrow("into itself");
    await vault.folders.create("areas");
    await expect(vault.folders.rename("projects", "areas")).rejects.toThrow(
      "Already exists",
    );
    await expect(vault.folders.rename("Inbox.md", "x")).rejects.toThrow(
      "Not a folder",
    );
    expect(await vault.notes.read("projects/Carbon.md")).toBe("carbon");
  });

  test("removes a folder with everything inside", async () => {
    const { vault } = await openVault();
    await vault.folders.remove("projects");
    expect(await paths(vault)).toEqual(["Inbox.md", "projects.md"]);
  });

  test("remove rejects a note, a missing folder and the vault root", async () => {
    const { vault, fs } = await openVault();
    await expect(vault.folders.remove("Inbox.md")).rejects.toThrow(
      "Not a folder",
    );
    await expect(vault.folders.remove("nope")).rejects.toThrow("ENOENT");
    for (const path of ["", ".", "..", "../outside"]) {
      await expect(vault.folders.remove(path)).rejects.toThrow(
        "Invalid vault path",
      );
    }
    expect(await fs.exists("/outside/secret.md")).toBe(true);
    expect(await vault.notes.read("Inbox.md")).toBe("# Inbox");
  });
});
