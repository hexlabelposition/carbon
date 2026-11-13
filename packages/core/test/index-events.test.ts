import { describe, expect, test } from "bun:test";
import { Vault, type IndexStatus } from "../src/index";
import { createMemoryPlatform } from "./fakes";

/** A platform with a vault of `count` notes at `/v`. */
async function platformWith(count: number) {
  const platform = createMemoryPlatform(
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => [`/v/n${i}.md`, `# Note ${i}`]),
    ),
  );
  await platform.fs.mkdir("/v");
  return platform;
}

/** Records the index events of a vault, and its status at each. */
function listen(vault: Vault) {
  const events: unknown[] = [];
  const statuses: IndexStatus[] = [vault.indexStatus];
  vault.on("index:progress", (progress) => {
    events.push(progress);
    statuses.push(vault.indexStatus);
  });
  vault.on("index:ready", () => {
    events.push("ready");
    statuses.push(vault.indexStatus);
  });
  return { events, statuses };
}

describe("index events", () => {
  test("progress by batch of the startup scan, then ready", async () => {
    const vault = await Vault.open("/v", await platformWith(450));
    const { events, statuses } = listen(vault);
    await vault.indexed();

    expect(events).toEqual([
      { done: 0, total: 450 },
      { done: 200, total: 450 },
      { done: 400, total: 450 },
      { done: 450, total: 450 },
      "ready",
    ]);
    expect(statuses[0]).toEqual({ state: "scanning", done: 0, total: null });
    expect(statuses[2]).toEqual({ state: "scanning", done: 200, total: 450 });
    expect(vault.indexStatus).toEqual({ state: "ready" });
    vault.close();
  });

  test("ready at once when nothing changed since the last start", async () => {
    const platform = await platformWith(3);
    const first = await Vault.open("/v", platform);
    await first.indexed();
    first.close();

    const vault = await Vault.open("/v", platform);
    const { events } = listen(vault);
    await vault.indexed();
    expect(events).toEqual([{ done: 0, total: 0 }, "ready"]);
    vault.close();
  });

  test("failed, with no ready, when the index cannot be opened", async () => {
    const platform = await platformWith(1);
    const broken = new Error("no database");
    platform.sql.open = () => Promise.reject(broken);
    const vault = await Vault.open("/v", platform);
    const { events } = listen(vault);

    await expect(vault.indexed()).rejects.toBe(broken);
    expect(events).toEqual([]);
    expect(vault.indexStatus).toEqual({ state: "failed", error: broken });
    vault.close();
  });

  test("nothing after the vault is closed", async () => {
    const vault = await Vault.open("/v", await platformWith(10));
    const { events } = listen(vault);
    vault.close();
    await vault.indexed().catch(() => {});
    expect(events).toEqual([]);
  });
});
