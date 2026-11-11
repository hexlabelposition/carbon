import { describe, expect, test } from "bun:test";
import { Vault } from "../src/index";
import { createMemoryPlatform } from "./fakes";

const files = {
  "/vault/Inbox.md": "# Inbox",
  "/vault/projects/Carbon.md": "Fast notes. See [[Inbox]].",
  "/outside/secret.md": "secret",
};

describe("Vault.open", () => {
  test("opens a folder and normalizes the root", async () => {
    const vault = await Vault.open("/vault/", createMemoryPlatform(files));
    expect(vault.root).toBe("/vault");
  });

  test("rejects a root that is a file", async () => {
    const open = Vault.open("/vault/Inbox.md", createMemoryPlatform(files));
    await expect(open).rejects.toThrow("not a folder");
  });

  test("rejects a root that does not exist", async () => {
    const open = Vault.open("/missing", createMemoryPlatform(files));
    await expect(open).rejects.toThrow("ENOENT");
  });
});

describe("vault.notes.read", () => {
  test("reads a note by its vault-relative path", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    expect(await vault.notes.read("Inbox.md")).toBe("# Inbox");
    expect(await vault.notes.read("projects/Carbon.md")).toContain("[[Inbox]]");
  });

  test("rejects a note that does not exist", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await expect(vault.notes.read("Nope.md")).rejects.toThrow("ENOENT");
  });

  test.each([
    "../outside/secret.md",
    "/outside/secret.md",
    "a/../../x",
    "",
    "a//b",
    "C:/x",
  ])("rejects the path %p, which could leave the vault", async (path) => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await expect(vault.notes.read(path)).rejects.toThrow("Invalid vault path");
  });
});

describe("vault.notes.write", () => {
  test("replaces the text of an existing note", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await vault.notes.write("Inbox.md", "# Inbox\n\nNew line");
    expect(await vault.notes.read("Inbox.md")).toBe("# Inbox\n\nNew line");
  });

  test("creates a note that does not exist yet", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await vault.notes.write("projects/New.md", "new");
    expect(await vault.notes.read("projects/New.md")).toBe("new");
  });

  test("keeps empty and non-ASCII text as is", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await vault.notes.write("Inbox.md", "");
    expect(await vault.notes.read("Inbox.md")).toBe("");
    await vault.notes.write("Inbox.md", "Заметка 📝\r\n");
    expect(await vault.notes.read("Inbox.md")).toBe("Заметка 📝\r\n");
  });

  test("goes through the atomic write of the platform", async () => {
    const platform = createMemoryPlatform(files);
    const calls: string[] = [];
    const writeTextAtomic = platform.fs.writeTextAtomic.bind(platform.fs);
    platform.fs.writeTextAtomic = async (path, content) => {
      calls.push(path);
      await writeTextAtomic(path, content);
    };
    const vault = await Vault.open("/vault", platform);

    await vault.notes.write("projects/Carbon.md", "x");

    expect(calls).toEqual(["/vault/projects/Carbon.md"]);
  });

  test("rejects when the folder does not exist", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await expect(vault.notes.write("missing/New.md", "x")).rejects.toThrow(
      "ENOENT",
    );
  });

  test("rejects a path that could leave the vault and writes nothing", async () => {
    const platform = createMemoryPlatform(files);
    const vault = await Vault.open("/vault", platform);

    await expect(
      vault.notes.write("../outside/secret.md", "overwritten"),
    ).rejects.toThrow("Invalid vault path");
    expect(await platform.fs.readText("/outside/secret.md")).toBe("secret");
  });
});

describe("vault.on", () => {
  test("returns a function that unsubscribes", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    const off = vault.on("index:ready", () => {});
    expect(off).toBeFunction();
    off();
  });
});
