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

describe("vault.on", () => {
  test("returns a function that unsubscribes", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    const off = vault.on("index:ready", () => {});
    expect(off).toBeFunction();
    off();
  });
});
