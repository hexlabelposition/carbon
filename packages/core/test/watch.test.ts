import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { contentHash, Vault, type VaultChange } from "../src/index";
import { createMemoryPlatform, type MemoryPlatform } from "./fakes";

const DELAY = 100;
const INBOX_HASH = contentHash("# Inbox");

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

/** Lets time pass, then lets the vault finish checking the disk. */
async function wait(ms: number) {
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 100; i++) await Promise.resolve();
}

async function openVault() {
  const platform = createMemoryPlatform({
    "/vault/Inbox.md": "# Inbox",
    "/vault/projects/Carbon.md": "carbon",
    "/vault/projects/archive/Old.md": "old",
  });
  const vault = await Vault.open("/vault", platform, { changeDelayMs: DELAY });
  const changes: VaultChange[] = [];
  vault.on("changed", (change) => changes.push(change));
  return { vault, changes, outside: new Outside(platform) };
}

/** Another program working in the vault folder: changes the disk and reports events. */
class Outside {
  constructor(readonly platform: MemoryPlatform) {}

  async create(path: string, content = "") {
    await this.platform.fs.writeTextAtomic(path, content);
    this.platform.watcher.emit({ kind: "created", path });
    this.platform.watcher.emit({ kind: "modified", path });
  }

  async modify(path: string, content: string) {
    await this.platform.fs.writeTextAtomic(path, content);
    this.platform.watcher.emit({ kind: "modified", path });
  }

  async remove(path: string, options?: { recursive?: boolean }) {
    await this.platform.fs.remove(path, options);
    this.platform.watcher.emit({ kind: "removed", path });
  }

  async mkdir(path: string) {
    await this.platform.fs.mkdir(path);
    this.platform.watcher.emit({ kind: "created", path });
  }

  /** Reports every event a real watcher would send for what the vault just did. */
  echo(...events: [kind: "created" | "modified" | "removed", path: string][]) {
    for (const [kind, path] of events)
      this.platform.watcher.emit({ kind, path });
  }
}

describe("outside changes", () => {
  test("a new note is reported as added", async () => {
    const { changes, outside } = await openVault();
    await outside.create("/vault/New.md", "new");
    await wait(DELAY);
    expect(changes).toEqual([{ kind: "added", path: "New.md" }]);
  });

  test("an edited note is reported as changed", async () => {
    const { changes, outside } = await openVault();
    await outside.modify("/vault/projects/Carbon.md", "edited");
    await wait(DELAY);
    expect(changes).toEqual([{ kind: "changed", path: "projects/Carbon.md" }]);
  });

  test("a deleted note is reported as removed", async () => {
    const { changes, outside } = await openVault();
    await outside.remove("/vault/Inbox.md");
    await wait(DELAY);
    expect(changes).toEqual([{ kind: "removed", path: "Inbox.md" }]);
  });

  test("nothing is reported before the vault has been quiet for the delay", async () => {
    const { changes, outside } = await openVault();
    await outside.modify("/vault/Inbox.md", "1");
    await wait(DELAY - 1);
    expect(changes).toEqual([]);
    await outside.modify("/vault/Inbox.md", "12");
    await wait(DELAY - 1);
    expect(changes).toEqual([]);
    await wait(1);
    expect(changes).toEqual([{ kind: "changed", path: "Inbox.md" }]);
  });

  test("a burst is reported once per path, in path order", async () => {
    const { changes, outside } = await openVault();
    await outside.modify("/vault/projects/Carbon.md", "a");
    await outside.modify("/vault/Inbox.md", "b");
    await outside.modify("/vault/projects/Carbon.md", "c");
    await outside.create("/vault/Zed.md");
    await wait(DELAY);
    expect(changes).toEqual([
      { kind: "changed", path: "Inbox.md" },
      { kind: "added", path: "Zed.md" },
      { kind: "changed", path: "projects/Carbon.md" },
    ]);
  });

  test("a file created and deleted within one burst is not reported", async () => {
    const { changes, outside } = await openVault();
    await outside.create("/vault/Temp.md");
    await outside.remove("/vault/Temp.md");
    await wait(DELAY);
    expect(changes).toEqual([]);
  });

  test("a save that replaces the file is reported as changed", async () => {
    // Many editors delete the note and create it again, or rename over it.
    const { changes, outside } = await openVault();
    await outside.remove("/vault/Inbox.md");
    await outside.create("/vault/Inbox.md", "replaced");
    await wait(DELAY);
    expect(changes).toEqual([{ kind: "changed", path: "Inbox.md" }]);
  });

  test("a file edited and then deleted is reported as removed", async () => {
    const { changes, outside } = await openVault();
    await outside.modify("/vault/Inbox.md", "x");
    await outside.remove("/vault/Inbox.md");
    await wait(DELAY);
    expect(changes).toEqual([{ kind: "removed", path: "Inbox.md" }]);
  });

  test("folders are reported when added or removed, not when their contents change", async () => {
    const { changes, outside } = await openVault();
    await outside.mkdir("/vault/areas");
    await wait(DELAY);
    await outside.create("/vault/areas/Health.md");
    outside.echo(["modified", "/vault/areas"]);
    await wait(DELAY);
    await outside.remove("/vault/projects", { recursive: true });
    await wait(DELAY);
    expect(changes).toEqual([
      { kind: "added", path: "areas" },
      { kind: "added", path: "areas/Health.md" },
      { kind: "removed", path: "projects" },
    ]);
  });

  test("hidden files and folders are ignored", async () => {
    const { changes, outside } = await openVault();
    await outside.create("/vault/.Inbox.md.x1y2.tmp");
    await outside.mkdir("/vault/.git");
    await outside.create("/vault/.git/index");
    await outside.create("/vault/projects/.DS_Store");
    await wait(DELAY);
    expect(changes).toEqual([]);
  });

  test("an event with nothing behind it is not reported", async () => {
    const { changes, outside } = await openVault();
    outside.echo(
      ["modified", "/vault/Ghost.md"],
      ["created", "/vault/Ghost2.md"],
    );
    await wait(DELAY);
    // Ghost.md "existed" according to the event and is gone now.
    expect(changes).toEqual([{ kind: "removed", path: "Ghost.md" }]);
  });
});

describe("the vault's own changes", () => {
  test("write is not reported", async () => {
    const { vault, changes, outside } = await openVault();
    await vault.notes.write("Inbox.md", "saved", INBOX_HASH);
    outside.echo(
      ["removed", "/vault/Inbox.md"],
      ["created", "/vault/Inbox.md"],
    );
    await wait(DELAY);
    // Late events for the same save arrive in a second burst.
    outside.echo(["modified", "/vault/Inbox.md"]);
    await wait(DELAY);
    expect(changes).toEqual([]);
  });

  test("create is not reported, including the folders it made", async () => {
    const { vault, changes, outside } = await openVault();
    await vault.notes.create("areas/health/Sleep.md", "zzz");
    outside.echo(
      ["created", "/vault/areas"],
      ["created", "/vault/areas/health"],
      ["created", "/vault/areas/health/Sleep.md"],
    );
    await wait(DELAY);
    expect(changes).toEqual([]);
  });

  test("rename is not reported", async () => {
    const { vault, changes, outside } = await openVault();
    await vault.notes.rename("Inbox.md", "projects/Today.md");
    outside.echo(
      ["removed", "/vault/Inbox.md"],
      ["created", "/vault/projects/Today.md"],
    );
    await wait(DELAY);
    expect(changes).toEqual([]);
  });

  test("remove is not reported", async () => {
    const { vault, changes, outside } = await openVault();
    await vault.notes.remove("Inbox.md");
    outside.echo(["removed", "/vault/Inbox.md"]);
    await wait(DELAY);
    expect(changes).toEqual([]);
  });

  test("folder operations are not reported, with everything inside", async () => {
    const { vault, changes, outside } = await openVault();
    await vault.folders.create("areas");
    await vault.folders.rename("projects", "work");
    outside.echo(
      ["created", "/vault/areas"],
      ["removed", "/vault/projects"],
      ["created", "/vault/work"],
    );
    await wait(DELAY);
    await vault.folders.remove("work");
    outside.echo(
      ["removed", "/vault/work/archive/Old.md"],
      ["removed", "/vault/work/archive"],
      ["removed", "/vault/work/Carbon.md"],
      ["removed", "/vault/work"],
    );
    await wait(DELAY);
    expect(changes).toEqual([]);
  });

  test("an outside edit right after a save is still reported", async () => {
    const { vault, changes, outside } = await openVault();
    await vault.notes.write("Inbox.md", "saved", INBOX_HASH);
    outside.echo(["modified", "/vault/Inbox.md"]);
    await outside.modify("/vault/Inbox.md", "theirs");
    await wait(DELAY);
    expect(changes).toEqual([{ kind: "changed", path: "Inbox.md" }]);
  });

  test("an outside delete of a note the vault wrote is reported", async () => {
    const { vault, changes, outside } = await openVault();
    await vault.notes.write("Inbox.md", "saved", INBOX_HASH);
    await outside.remove("/vault/Inbox.md");
    await wait(DELAY);
    expect(changes).toEqual([{ kind: "removed", path: "Inbox.md" }]);
  });

  test("after a removed folder comes back, deletions inside it are reported", async () => {
    const { vault, changes, outside } = await openVault();
    await vault.folders.remove("projects");
    await outside.mkdir("/vault/projects");
    await outside.create("/vault/projects/Back.md");
    await wait(DELAY);
    await outside.remove("/vault/projects/Back.md");
    await wait(DELAY);
    expect(changes).toEqual([
      { kind: "added", path: "projects" },
      { kind: "added", path: "projects/Back.md" },
      { kind: "removed", path: "projects/Back.md" },
    ]);
  });
});

describe("the tree while watching", () => {
  async function listCalls() {
    const opened = await openVault();
    const { platform } = opened.outside;
    let calls = 0;
    const list = platform.fs.list.bind(platform.fs);
    platform.fs.list = (dir) => {
      calls++;
      return list(dir);
    };
    return { ...opened, calls: () => calls };
  }

  test("is listed once and reused", async () => {
    const { vault, calls } = await listCalls();
    const first = await vault.tree();
    const listed = calls();
    expect(await vault.tree()).toBe(first);
    expect(calls()).toBe(listed);
  });

  test("is listed again after an outside change, without waiting for the delay", async () => {
    const { vault, outside } = await listCalls();
    await vault.tree();
    await outside.create("/vault/New.md");
    expect((await vault.tree()).map((n) => n.name)).toContain("New.md");
  });

  test("is listed again after the vault's own change", async () => {
    const { vault } = await listCalls();
    await vault.tree();
    await vault.notes.create("New.md");
    expect((await vault.tree()).map((n) => n.name)).toContain("New.md");
    await vault.notes.remove("New.md");
    expect((await vault.tree()).map((n) => n.name)).not.toContain("New.md");
  });
});

describe("starting and stopping", () => {
  test("an open vault is watched, a closed one is not", async () => {
    const platform = createMemoryPlatform({ "/vault/a.md": "" });
    const vault = await Vault.open("/vault", platform);
    expect(vault.watching).toBe(true);
    expect(platform.watcher.watchCount).toBe(1);

    vault.close();
    expect(vault.watching).toBe(false);
    expect(platform.watcher.watchCount).toBe(0);
  });

  test("close drops changes that were waiting for the delay", async () => {
    const { vault, changes, outside } = await openVault();
    await outside.modify("/vault/Inbox.md", "x");
    vault.close();
    await wait(DELAY);
    expect(changes).toEqual([]);
  });

  test("a vault opens without a working watcher and does not cache the tree", async () => {
    const platform = createMemoryPlatform({ "/vault/a.md": "" });
    platform.watcher.watch = () =>
      Promise.reject(new Error("no inotify watches left"));
    const vault = await Vault.open("/vault", platform);
    expect(vault.watching).toBe(false);

    await vault.tree();
    await platform.fs.writeTextAtomic("/vault/b.md", "");
    expect((await vault.tree()).map((n) => n.name)).toEqual(["a.md", "b.md"]);
  });
});
