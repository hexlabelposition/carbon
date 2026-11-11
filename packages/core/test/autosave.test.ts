import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { Autosave, contentHash, Vault, type SaveState } from "../src/index";
import { createMemoryPlatform } from "./fakes";

const DELAY = 1000;
const MAX_DELAY = 5000;
const FILE = "/vault/Inbox.md";

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

/** Lets time pass, then lets the writes that started finish. */
async function wait(ms: number) {
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

async function setup() {
  const platform = createMemoryPlatform({ [FILE]: "# Inbox" });
  const vault = await Vault.open("/vault", platform);
  const states: string[] = [];
  const autosave = new Autosave({
    notes: vault.notes,
    path: "Inbox.md",
    baseHash: contentHash("# Inbox"),
    delayMs: DELAY,
    maxDelayMs: MAX_DELAY,
    onState: (state: SaveState) => states.push(state.status),
  });
  const onDisk = () => platform.fs.readText(FILE);
  return { platform, autosave, states, onDisk };
}

describe("Autosave", () => {
  test("writes after typing pauses, not before", async () => {
    const { autosave, onDisk, states } = await setup();
    expect(autosave.state).toEqual({ status: "saved" });

    autosave.edit("# Inbox\n\nOne");
    await wait(DELAY - 1);
    expect(await onDisk()).toBe("# Inbox");
    expect(autosave.state).toEqual({ status: "unsaved" });

    await wait(1);
    expect(await onDisk()).toBe("# Inbox\n\nOne");
    expect(states).toEqual(["unsaved", "saved"]);
  });

  test("every edit restarts the pause; only the last text is written", async () => {
    const { platform, autosave, onDisk } = await setup();
    const written: string[] = [];
    const write = platform.fs.writeTextAtomic.bind(platform.fs);
    platform.fs.writeTextAtomic = async (path, content) => {
      written.push(content);
      await write(path, content);
    };

    autosave.edit("a");
    await wait(DELAY / 2);
    autosave.edit("ab");
    await wait(DELAY / 2);
    autosave.edit("abc");
    await wait(DELAY / 2);
    expect(written).toEqual([]);

    await wait(DELAY / 2);
    expect(written).toEqual(["abc"]);
    expect(await onDisk()).toBe("abc");
  });

  test("typing without a pause is still saved after the longest wait", async () => {
    const { autosave, onDisk } = await setup();
    for (let time = 0; time < MAX_DELAY; time += DELAY / 2) {
      autosave.edit(`typed for ${time} ms`);
      await wait(DELAY / 2);
    }
    expect(await onDisk()).toBe(`typed for ${MAX_DELAY - DELAY / 2} ms`);
  });

  test("flush writes at once", async () => {
    const { autosave, onDisk } = await setup();
    autosave.edit("now");
    await autosave.flush();
    expect(await onDisk()).toBe("now");
    expect(autosave.state).toEqual({ status: "saved" });
    // The timers of the edit are gone: nothing else is written later.
    await wait(MAX_DELAY);
    expect(await onDisk()).toBe("now");
  });

  test("flush with nothing to save does nothing", async () => {
    const { platform, autosave, states } = await setup();
    const before = await platform.fs.stat(FILE);
    await autosave.flush();
    expect(await platform.fs.stat(FILE)).toEqual(before);
    expect(states).toEqual([]);
  });

  test("an edit made during a write is written next, one write at a time", async () => {
    const { platform, autosave, onDisk } = await setup();
    const write = platform.fs.writeTextAtomic.bind(platform.fs);
    let inFlight = 0;
    let most = 0;
    let release = () => {};
    platform.fs.writeTextAtomic = async (path, content) => {
      most = Math.max(most, ++inFlight);
      if (content === "first") {
        await new Promise<void>((resolve) => (release = resolve));
      }
      await write(path, content);
      inFlight--;
    };

    autosave.edit("first");
    const flushed = autosave.flush();
    await wait(0);
    autosave.edit("second");
    expect(autosave.state).toEqual({ status: "unsaved" });
    release();
    await flushed;

    // Based on the hash of "first", so it is not a conflict with itself.
    expect(await onDisk()).toBe("second");
    expect(autosave.state).toEqual({ status: "saved" });
    expect(most).toBe(1);
  });

  test("a note changed by someone else is a conflict, and nothing is written", async () => {
    const { platform, autosave, onDisk, states } = await setup();
    await platform.fs.writeTextAtomic(FILE, "theirs");

    autosave.edit("mine");
    await wait(DELAY);
    expect(autosave.state).toEqual({ status: "conflict" });
    expect(await onDisk()).toBe("theirs");

    // Later edits wait as well, they are not written over the other version.
    autosave.edit("mine, more");
    await wait(MAX_DELAY);
    await autosave.flush();
    expect(await onDisk()).toBe("theirs");
    expect(states).toEqual(["unsaved", "conflict"]);
  });

  test("keepMine writes the editor text over the other version", async () => {
    const { platform, autosave, onDisk } = await setup();
    await platform.fs.writeTextAtomic(FILE, "theirs");
    autosave.edit("mine");
    await autosave.flush();
    autosave.edit("mine, more");

    await autosave.keepMine(contentHash("theirs"));

    expect(await onDisk()).toBe("mine, more");
    expect(autosave.state).toEqual({ status: "saved" });
    // Saving goes on as usual afterwards.
    autosave.edit("mine, even more");
    await wait(DELAY);
    expect(await onDisk()).toBe("mine, even more");
  });

  test("keepMine brings back a note that was deleted", async () => {
    const { platform, autosave, onDisk } = await setup();
    await platform.fs.remove(FILE);
    autosave.edit("mine");
    await autosave.flush();
    expect(autosave.state).toEqual({ status: "conflict" });

    await autosave.keepMine(null);

    expect(await onDisk()).toBe("mine");
    expect(autosave.state).toEqual({ status: "saved" });
  });

  test("keepMine is a conflict again if the disk changed once more", async () => {
    const { platform, autosave, onDisk } = await setup();
    await platform.fs.writeTextAtomic(FILE, "theirs");
    autosave.edit("mine");
    await autosave.flush();
    await platform.fs.writeTextAtomic(FILE, "theirs, again");

    await autosave.keepMine(contentHash("theirs"));

    expect(autosave.state).toEqual({ status: "conflict" });
    expect(await onDisk()).toBe("theirs, again");
  });

  test("useDisk drops the unsaved edits and saves later ones on top", async () => {
    const { platform, autosave, onDisk, states } = await setup();
    await platform.fs.writeTextAtomic(FILE, "theirs");
    autosave.edit("mine");
    await autosave.flush();

    autosave.useDisk(contentHash("theirs"));
    expect(autosave.state).toEqual({ status: "saved" });
    await wait(MAX_DELAY);
    expect(await onDisk()).toBe("theirs");

    autosave.edit("theirs, and mine");
    await wait(DELAY);
    expect(await onDisk()).toBe("theirs, and mine");
    expect(states).toEqual([
      "unsaved",
      "conflict",
      "saved",
      "unsaved",
      "saved",
    ]);
  });

  test("useDisk before a pending write cancels that write", async () => {
    const { platform, autosave, onDisk } = await setup();
    autosave.edit("mine");
    await platform.fs.writeTextAtomic(FILE, "theirs");
    autosave.useDisk(contentHash("theirs"));
    await wait(MAX_DELAY);
    expect(await onDisk()).toBe("theirs");
    expect(autosave.state).toEqual({ status: "saved" });
  });

  test("a failed write is reported and the next edit tries again", async () => {
    const { platform, autosave, onDisk } = await setup();
    const write = platform.fs.writeTextAtomic.bind(platform.fs);
    platform.fs.writeTextAtomic = () => Promise.reject(new Error("disk full"));

    autosave.edit("one");
    await wait(DELAY);
    expect(autosave.state).toEqual({ status: "failed", message: "disk full" });
    expect(await onDisk()).toBe("# Inbox");

    platform.fs.writeTextAtomic = write;
    autosave.edit("one two");
    await wait(DELAY);
    expect(await onDisk()).toBe("one two");
    expect(autosave.state).toEqual({ status: "saved" });
  });

  test("after a failed write, flush retries the same text", async () => {
    const { platform, autosave, onDisk } = await setup();
    const write = platform.fs.writeTextAtomic.bind(platform.fs);
    platform.fs.writeTextAtomic = () => Promise.reject(new Error("disk full"));
    autosave.edit("kept");
    await autosave.flush();

    platform.fs.writeTextAtomic = write;
    await autosave.flush();
    expect(await onDisk()).toBe("kept");
  });

  test("close writes what is unsaved, then ignores edits and stays quiet", async () => {
    const { autosave, onDisk, states } = await setup();
    autosave.edit("last words");
    await autosave.close();
    expect(await onDisk()).toBe("last words");

    autosave.edit("too late");
    await wait(MAX_DELAY);
    expect(await onDisk()).toBe("last words");
    expect(states).toEqual(["unsaved"]);
  });
});
