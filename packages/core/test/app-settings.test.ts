import { describe, expect, test } from "bun:test";
import { AppSettings } from "../src/index";
import { MemorySettingsStore } from "./fakes";

async function loadSettings(text: string | null = null) {
  const store = new MemorySettingsStore(text);
  return { store, settings: await AppSettings.load(store) };
}

const paths = (settings: AppSettings) =>
  settings.recentVaults.map((v) => v.path);

describe("recent vaults", () => {
  test("the list is empty before anything was saved", async () => {
    const { settings, store } = await loadSettings();
    expect(settings.recentVaults).toEqual([]);
    expect(store.text).toBeNull();
  });

  test("the latest opened vault comes first", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    await settings.addRecentVault("/home/me/work");
    expect(paths(settings)).toEqual(["/home/me/work", "/home/me/notes"]);
  });

  test("opening a vault again moves it to the front, without a duplicate", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    await settings.addRecentVault("/home/me/work");
    await settings.addRecentVault("/home/me/notes");
    expect(paths(settings)).toEqual(["/home/me/notes", "/home/me/work"]);
  });

  test("the same folder written differently is one vault", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("C:\\Users\\me\\notes");
    await settings.addRecentVault("C:/Users/me/notes/");
    expect(paths(settings)).toEqual(["C:/Users/me/notes"]);
  });

  test("keeps the ten latest vaults", async () => {
    const { settings } = await loadSettings();
    for (let i = 1; i <= 12; i++) await settings.addRecentVault(`/vaults/${i}`);
    expect(paths(settings)).toHaveLength(10);
    expect(paths(settings)[0]).toBe("/vaults/12");
    expect(paths(settings)[9]).toBe("/vaults/3");
  });

  test("a vault can be taken off the list", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    await settings.addRecentVault("/home/me/work");
    await settings.removeRecentVault("/home/me/work/");
    await settings.removeRecentVault("/home/me/unknown");
    expect(paths(settings)).toEqual(["/home/me/notes"]);
  });

  test("rejects a path that cannot be a vault", async () => {
    const { settings } = await loadSettings();
    await expect(settings.addRecentVault("")).rejects.toThrow(
      "Invalid vault root",
    );
    expect(settings.recentVaults).toEqual([]);
  });

  test("a change gives a new list and leaves the old one as it was", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    const before = settings.recentVaults;
    await settings.addRecentVault("/home/me/work");
    expect(before).toEqual([
      { path: "/home/me/notes", lastOpenedNote: null, recentNotes: [] },
    ]);
    expect(settings.recentVaults).not.toBe(before);
  });
});

describe("last opened note", () => {
  test("is remembered per vault", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    await settings.addRecentVault("/home/me/work");
    await settings.setLastOpenedNote("/home/me/notes", "Inbox.md");
    await settings.setLastOpenedNote("/home/me/work/", "projects/Carbon.md");

    expect(settings.lastOpenedNote("/home/me/notes")).toBe("Inbox.md");
    expect(settings.lastOpenedNote("/home/me/work")).toBe("projects/Carbon.md");
    // Remembering a note is not opening a vault: the order stays.
    expect(paths(settings)).toEqual(["/home/me/work", "/home/me/notes"]);
  });

  test("is null for a new vault and after it is cleared", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    expect(settings.lastOpenedNote("/home/me/notes")).toBeNull();
    await settings.setLastOpenedNote("/home/me/notes", "Inbox.md");
    await settings.setLastOpenedNote("/home/me/notes", null);
    expect(settings.lastOpenedNote("/home/me/notes")).toBeNull();
  });

  test("survives opening the vault again", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    await settings.setLastOpenedNote("/home/me/notes", "Inbox.md");
    await settings.addRecentVault("/home/me/work");
    await settings.addRecentVault("/home/me/notes");
    expect(settings.lastOpenedNote("/home/me/notes")).toBe("Inbox.md");
  });

  test("is ignored for a vault that is not on the list", async () => {
    const { settings, store } = await loadSettings();
    await settings.setLastOpenedNote("/home/me/unknown", "Inbox.md");
    expect(settings.lastOpenedNote("/home/me/unknown")).toBeNull();
    expect(settings.recentVaults).toEqual([]);
    expect(store.text).toBeNull();
  });
});

describe("recent notes", () => {
  test("are the opened notes of a vault, the latest first, once each", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/v");
    for (const note of ["a.md", "b.md", null, "a.md", "c.md"]) {
      await settings.setLastOpenedNote("/v", note);
    }
    expect(settings.recentNotes("/v")).toEqual(["c.md", "a.md", "b.md"]);
    expect(settings.recentNotes("/unknown")).toEqual([]);
  });

  test("keep the thirty latest", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/v");
    for (let i = 0; i < 35; i++) {
      await settings.setLastOpenedNote("/v", `n${i}.md`);
    }
    const recent = settings.recentNotes("/v");
    expect(recent).toHaveLength(30);
    expect(recent[0]).toBe("n34.md");
    expect(recent[29]).toBe("n5.md");
  });

  test("follow a moved note or folder", async () => {
    const { settings, store } = await loadSettings();
    await settings.addRecentVault("/v");
    for (const note of ["dir/a.md", "dir/sub/b.md", "dirt.md", "x.md"]) {
      await settings.setLastOpenedNote("/v", note);
    }
    await settings.moveNotes("/v", "dir", "new");
    expect(settings.recentNotes("/v")).toEqual([
      "x.md",
      "dirt.md",
      "new/sub/b.md",
      "new/a.md",
    ]);
    await settings.moveNotes("/v", "x.md", "y.md");
    expect(settings.lastOpenedNote("/v")).toBe("y.md");
    expect((await AppSettings.load(store)).recentNotes("/v")[0]).toBe("y.md");
  });

  test("keep one entry when a note moves onto another on the list", async () => {
    const { settings } = await loadSettings();
    await settings.addRecentVault("/v");
    await settings.setLastOpenedNote("/v", "a.md");
    await settings.setLastOpenedNote("/v", "b.md");
    await settings.moveNotes("/v", "a.md", "b.md");
    expect(settings.recentNotes("/v")).toEqual(["b.md"]);
  });

  test("a move that changes nothing does not save", async () => {
    const { settings, store } = await loadSettings();
    await settings.addRecentVault("/v");
    await settings.setLastOpenedNote("/v", "a.md");
    let writes = 0;
    store.write = async () => void writes++;
    await settings.moveNotes("/v", "other.md", "new.md");
    await settings.moveNotes("/unknown", "a.md", "b.md");
    expect(writes).toBe(0);
  });
});

describe("saving and loading", () => {
  test("what was saved is there after a restart", async () => {
    const { settings, store } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    await settings.addRecentVault("/home/me/work");
    await settings.setLastOpenedNote("/home/me/notes", "Inbox.md");
    await settings.removeRecentVault("/home/me/work");

    const restarted = await AppSettings.load(store);

    expect(restarted.recentVaults).toEqual([
      {
        path: "/home/me/notes",
        lastOpenedNote: "Inbox.md",
        recentNotes: ["Inbox.md"],
      },
    ]);
  });

  test("the saved text is readable JSON", async () => {
    const { settings, store } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    expect(store.text).toBe(
      '{\n  "recentVaults": [\n    {\n      "path": "/home/me/notes",\n      "lastOpenedNote": null,\n      "recentNotes": []\n    }\n  ]\n}\n',
    );
  });

  test("setting the same note again does not save", async () => {
    const { settings, store } = await loadSettings();
    await settings.addRecentVault("/home/me/notes");
    await settings.setLastOpenedNote("/home/me/notes", "Inbox.md");
    let writes = 0;
    store.write = async () => void writes++;
    await settings.setLastOpenedNote("/home/me/notes", "Inbox.md");
    expect(writes).toBe(0);
  });

  test.each([
    ["broken JSON", "{ not json"],
    ["an empty file", ""],
    ["JSON of another shape", "[1, 2, 3]"],
    ["a list that is not a list", '{ "recentVaults": "nope" }'],
  ])("starts with defaults after %s", async (_name, text) => {
    const { settings } = await loadSettings(text);
    expect(settings.recentVaults).toEqual([]);
    await settings.addRecentVault("/home/me/notes");
    expect(paths(settings)).toEqual(["/home/me/notes"]);
  });

  test("keeps the entries it understands and skips the rest", async () => {
    const { settings } = await loadSettings(
      JSON.stringify({
        somethingNewer: true,
        recentVaults: [
          {
            path: "/home/me/notes/",
            lastOpenedNote: "Inbox.md",
            recentNotes: ["Inbox.md", 3, "a.md", "Inbox.md"],
          },
          { path: 42 },
          null,
          { path: "" },
          { path: "/home/me/work", lastOpenedNote: 7, recentNotes: "x" },
          { path: "/home/me/notes" },
        ],
      }),
    );
    expect(settings.recentVaults).toEqual([
      {
        path: "/home/me/notes",
        lastOpenedNote: "Inbox.md",
        recentNotes: ["Inbox.md", "a.md"],
      },
      { path: "/home/me/work", lastOpenedNote: null, recentNotes: [] },
    ]);
  });

  test("a failed save rejects, and the next save still works", async () => {
    const { settings, store } = await loadSettings();
    const write = store.write.bind(store);
    store.write = () => Promise.reject(new Error("disk full"));
    await expect(settings.addRecentVault("/home/me/notes")).rejects.toThrow(
      "disk full",
    );

    store.write = write;
    await settings.addRecentVault("/home/me/work");

    const restarted = await AppSettings.load(store);
    expect(paths(restarted)).toEqual(["/home/me/work", "/home/me/notes"]);
  });

  test("changes made at once are saved in order, the last one wins", async () => {
    const { settings, store } = await loadSettings();
    const write = store.write.bind(store);
    let first = true;
    store.write = async (text) => {
      // The first save is slow; without a queue it would land last.
      if (first) {
        first = false;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await write(text);
    };

    await Promise.all([
      settings.addRecentVault("/home/me/notes"),
      settings.addRecentVault("/home/me/work"),
    ]);

    const restarted = await AppSettings.load(store);
    expect(paths(restarted)).toEqual(["/home/me/work", "/home/me/notes"]);
  });
});
