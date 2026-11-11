import { describe, expect, test } from "bun:test";
import { contentHash, Vault, WriteConflictError } from "../src/index";
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

describe("Vault.create", () => {
  test("creates the folder and opens it as an empty vault", async () => {
    const platform = createMemoryPlatform(files);
    const vault = await Vault.create("/vault/projects/", "Diary", platform);
    expect(vault.root).toBe("/vault/projects/Diary");
    expect(await vault.tree()).toEqual([]);
    expect((await platform.fs.stat("/vault/projects/Diary")).kind).toBe("dir");
  });

  test("creates the parent folders that are missing", async () => {
    const vault = await Vault.create(
      "/new/place",
      "Diary",
      createMemoryPlatform(files),
    );
    expect(vault.root).toBe("/new/place/Diary");
  });

  test.each([
    ["/", "/Diary"],
    ["C:\\", "C:/Diary"],
  ])("accepts the drive root %p as the place", async (parent, root) => {
    const vault = await Vault.create(parent, "Diary", createMemoryPlatform());
    expect(vault.root).toBe(root);
  });

  test("rejects when a folder or file with that name exists", async () => {
    const platform = createMemoryPlatform(files);
    await expect(Vault.create("/vault", "projects", platform)).rejects.toThrow(
      "Already exists",
    );
    await expect(Vault.create("/vault", "Inbox.md", platform)).rejects.toThrow(
      "Already exists",
    );
    expect(await platform.fs.readText("/vault/Inbox.md")).toBe("# Inbox");
  });

  test.each([
    "",
    " ",
    " Diary",
    "Diary ",
    ".hidden",
    "..",
    "a/b",
    "a\\b",
    "a:b",
    "what?",
    "Diary.",
  ])("rejects the name %p and creates nothing", async (name) => {
    const platform = createMemoryPlatform(files);
    await expect(Vault.create("/vault", name, platform)).rejects.toThrow(
      "Invalid vault name",
    );
    expect(await platform.fs.list("/vault")).toHaveLength(2);
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
  const inbox = contentHash("# Inbox");

  test("replaces the text of an existing note", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await vault.notes.write("Inbox.md", "# Inbox\n\nNew line", inbox);
    expect(await vault.notes.read("Inbox.md")).toBe("# Inbox\n\nNew line");
  });

  test("creates a note that does not exist yet", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await vault.notes.write("projects/New.md", "new", null);
    expect(await vault.notes.read("projects/New.md")).toBe("new");
  });

  test("keeps empty and non-ASCII text as is", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    const empty = await vault.notes.write("Inbox.md", "", inbox);
    expect(await vault.notes.read("Inbox.md")).toBe("");
    await vault.notes.write("Inbox.md", "Заметка 📝\r\n", empty);
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

    await vault.notes.write(
      "projects/Carbon.md",
      "x",
      contentHash(files["/vault/projects/Carbon.md"]),
    );

    expect(calls).toEqual(["/vault/projects/Carbon.md"]);
  });

  test("rejects when the folder does not exist", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await expect(
      vault.notes.write("missing/New.md", "x", null),
    ).rejects.toThrow("ENOENT");
  });

  test("rejects a path that could leave the vault and writes nothing", async () => {
    const platform = createMemoryPlatform(files);
    const vault = await Vault.open("/vault", platform);

    await expect(
      vault.notes.write(
        "../outside/secret.md",
        "overwritten",
        contentHash("secret"),
      ),
    ).rejects.toThrow("Invalid vault path");
    expect(await platform.fs.readText("/outside/secret.md")).toBe("secret");
  });
});

describe("vault.notes.write, when the disk changed", () => {
  const inbox = contentHash("# Inbox");

  test("resolves with the hash to base the next write on", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    const first = await vault.notes.write("Inbox.md", "one", inbox);
    expect(first).toBe(contentHash("one"));
    await vault.notes.write("Inbox.md", "two", first);
    expect(await vault.notes.read("Inbox.md")).toBe("two");
  });

  test("rejects when the note was changed by someone else", async () => {
    const platform = createMemoryPlatform(files);
    const vault = await Vault.open("/vault", platform);
    await platform.fs.writeTextAtomic("/vault/Inbox.md", "theirs");

    const write = vault.notes.write("Inbox.md", "mine", inbox);

    await expect(write).rejects.toBeInstanceOf(WriteConflictError);
    await expect(write).rejects.toMatchObject({ path: "Inbox.md" });
    expect(await vault.notes.read("Inbox.md")).toBe("theirs");
  });

  test("rejects a second save based on an outdated version", async () => {
    const vault = await Vault.open("/vault", createMemoryPlatform(files));
    await vault.notes.write("Inbox.md", "one", inbox);

    await expect(
      vault.notes.write("Inbox.md", "two", inbox),
    ).rejects.toBeInstanceOf(WriteConflictError);
    expect(await vault.notes.read("Inbox.md")).toBe("one");
  });

  test("rejects when the note was deleted by someone else", async () => {
    const platform = createMemoryPlatform(files);
    const vault = await Vault.open("/vault", platform);
    await platform.fs.remove("/vault/Inbox.md");

    await expect(
      vault.notes.write("Inbox.md", "mine", inbox),
    ).rejects.toBeInstanceOf(WriteConflictError);
    expect(await platform.fs.exists("/vault/Inbox.md")).toBe(false);
  });

  test("rejects creating a note that someone else created first", async () => {
    const platform = createMemoryPlatform(files);
    const vault = await Vault.open("/vault", platform);
    await platform.fs.writeTextAtomic("/vault/New.md", "theirs");

    await expect(
      vault.notes.write("New.md", "mine", null),
    ).rejects.toBeInstanceOf(WriteConflictError);
    expect(await vault.notes.read("New.md")).toBe("theirs");
  });

  test("accepts a write when the disk already holds the same text", async () => {
    const platform = createMemoryPlatform(files);
    const vault = await Vault.open("/vault", platform);
    await platform.fs.writeTextAtomic("/vault/Inbox.md", "same edit");
    const before = await platform.fs.stat("/vault/Inbox.md");

    const hash = await vault.notes.write("Inbox.md", "same edit", inbox);

    expect(hash).toBe(contentHash("same edit"));
    // Nothing was written: the file is the one the other program left.
    expect(await platform.fs.stat("/vault/Inbox.md")).toEqual(before);
  });

  test("a note changed and changed back is not a conflict", async () => {
    const platform = createMemoryPlatform(files);
    const vault = await Vault.open("/vault", platform);
    await platform.fs.writeTextAtomic("/vault/Inbox.md", "theirs");
    await platform.fs.writeTextAtomic("/vault/Inbox.md", "# Inbox");

    await vault.notes.write("Inbox.md", "mine", inbox);

    expect(await vault.notes.read("Inbox.md")).toBe("mine");
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
