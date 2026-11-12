import { describe, expect, test } from "bun:test";
import { attachmentLink, contentHash, Vault } from "../src/index";
import { createMemoryPlatform } from "./fakes";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);

async function openVault() {
  const platform = createMemoryPlatform({
    "/vault/Inbox.md": "# Inbox",
    "/vault/projects/Carbon.md": "carbon",
    "/vault/projects/logo.png": "logo",
    "/vault/attachments/diagram.png": "diagram",
    "/vault/my pictures/a (1).png": "a",
    "/outside/secret.png": "secret",
  });
  const vault = await Vault.open("/vault", platform);
  return { vault, fs: platform.fs };
}

describe("vault.attachments.save", () => {
  test("saves the bytes into the attachments folder", async () => {
    const { vault } = await openVault();
    const path = await vault.attachments.save("photo.png", PNG);
    expect(path).toBe("attachments/photo.png");
    expect(await vault.attachments.read(path)).toEqual(PNG);
  });

  test("creates the attachments folder when it is missing", async () => {
    const platform = createMemoryPlatform({ "/vault/Inbox.md": "" });
    const vault = await Vault.open("/vault", platform);
    const path = await vault.attachments.save("photo.png", PNG);
    expect(path).toBe("attachments/photo.png");
    expect((await platform.fs.stat("/vault/attachments")).kind).toBe("dir");
  });

  test("never overwrites: a taken name gets a number", async () => {
    const { vault, fs } = await openVault();
    expect(await vault.attachments.save("diagram.png", PNG)).toBe(
      "attachments/diagram-1.png",
    );
    expect(await vault.attachments.save("diagram.png", PNG)).toBe(
      "attachments/diagram-2.png",
    );
    expect(await fs.readText("/vault/attachments/diagram.png")).toBe("diagram");
  });

  test.each([
    ["../../outside/evil.png", "attachments/evil.png"],
    ["a/b\\c.png", "attachments/c.png"],
    [".hidden.png", "attachments/hidden.png"],
    ["", "attachments/attachment"],
    ["no ending", "attachments/no ending"],
    ["Снимок экрана.png", "attachments/Снимок экрана.png"],
  ])("turns the name %p into a safe one", async (name, expected) => {
    const { vault, fs } = await openVault();
    expect(await vault.attachments.save(name, PNG)).toBe(expected);
    expect(await fs.exists("/outside/evil.png")).toBe(false);
  });

  test("a saved attachment is not reported as an outside change", async () => {
    const { vault } = await openVault();
    const events: string[] = [];
    vault.on("changed", (change) => events.push(change.path));
    vault.on("tree", () => events.push("tree"));
    await vault.attachments.save("photo.png", PNG);
    expect(events).toEqual(["tree"]);
  });
});

describe("vault.attachments.read", () => {
  test("rejects a path that could leave the vault", async () => {
    const { vault } = await openVault();
    await expect(
      vault.attachments.read("../outside/secret.png"),
    ).rejects.toThrow("Invalid vault path");
  });
});

describe("vault.attachments.find", () => {
  test.each([
    // Relative to the folder of the note, as Markdown means it.
    ["projects/Carbon.md", "logo.png", "projects/logo.png"],
    ["projects/Carbon.md", "./logo.png", "projects/logo.png"],
    [
      "projects/Carbon.md",
      "../attachments/diagram.png",
      "attachments/diagram.png",
    ],
    ["Inbox.md", "attachments/diagram.png", "attachments/diagram.png"],
    // Else relative to the vault root.
    [
      "projects/Carbon.md",
      "attachments/diagram.png",
      "attachments/diagram.png",
    ],
    [
      "projects/Carbon.md",
      "/attachments/diagram.png",
      "attachments/diagram.png",
    ],
    // Escaped, and the form for addresses with spaces.
    ["Inbox.md", "my%20pictures/a%20%281%29.png", "my pictures/a (1).png"],
    ["Inbox.md", "<my pictures/a (1).png>", "my pictures/a (1).png"],
    ["Inbox.md", "attachments\\diagram.png", "attachments/diagram.png"],
  ])("from %p, %p is %p", async (note, target, expected) => {
    const { vault } = await openVault();
    expect(await vault.attachments.find(note, target)).toBe(expected);
  });

  test.each([
    ["nothing there", "missing.png"],
    ["a folder", "projects"],
    ["a web address", "https://example.com/logo.png"],
    ["a data address", "data:image/png;base64,AAAA"],
    ["a protocol-relative address", "//example.com/logo.png"],
    ["a heading", "#section"],
    ["an empty address", ""],
    ["a path out of the vault", "../outside/secret.png"],
    ["a path far out of the vault", "../../../outside/secret.png"],
    ["an escaped path out of the vault", "..%2Foutside%2Fsecret.png"],
  ])("is null for %s", async (_what, target) => {
    const { vault } = await openVault();
    expect(await vault.attachments.find("Inbox.md", target)).toBeNull();
  });
});

describe("attachmentLink", () => {
  test.each([
    ["Inbox.md", "attachments/photo.png", "attachments/photo.png"],
    ["projects/Carbon.md", "attachments/photo.png", "../attachments/photo.png"],
    [
      "a/b/c/Note.md",
      "attachments/photo.png",
      "../../../attachments/photo.png",
    ],
    ["attachments/Note.md", "attachments/photo.png", "photo.png"],
    ["projects/Carbon.md", "projects/logo.png", "logo.png"],
    ["Inbox.md", "my pictures/a (1).png", "my%20pictures/a%20%281%29.png"],
    [
      "Inbox.md",
      "attachments/Снимок.png",
      "attachments/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA.png",
    ],
  ])("from %p to %p is %p", (note, path, expected) => {
    expect(attachmentLink(note, path)).toBe(expected);
  });

  test("the link leads back to the file it was made for", async () => {
    const { vault } = await openVault();
    for (const note of ["Inbox.md", "projects/Carbon.md"]) {
      const saved = await vault.attachments.save("my photo (2).png", PNG);
      const link = attachmentLink(note, saved);
      expect(await vault.attachments.find(note, link)).toBe(saved);
    }
  });
});

describe('the "tree" event', () => {
  test("is raised when the vault adds, moves or deletes something", async () => {
    const { vault } = await openVault();
    let count = 0;
    vault.on("tree", () => count++);
    const raised = async (action: () => Promise<unknown>) => {
      const before = count;
      await action();
      return count > before;
    };

    expect(await raised(() => vault.notes.create("New.md"))).toBe(true);
    expect(await raised(() => vault.notes.rename("New.md", "Newer.md"))).toBe(
      true,
    );
    expect(await raised(() => vault.folders.create("area"))).toBe(true);
    expect(await raised(() => vault.notes.remove("Newer.md"))).toBe(true);
    expect(await raised(() => vault.notes.write("Fresh.md", "x", null))).toBe(
      true,
    );
  });

  test("is not raised when a note only gets new text", async () => {
    const { vault } = await openVault();
    let count = 0;
    vault.on("tree", () => count++);
    await vault.notes.write(
      "Inbox.md",
      "# Inbox\n\nMore",
      contentHash("# Inbox"),
    );
    expect(count).toBe(0);
  });
});
