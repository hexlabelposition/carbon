import { describe, expect, test } from "bun:test";
import { Vault } from "../src/index";
import { createMemoryPlatform } from "./fakes";

const ROOT = "/v";
const CONFIG = `${ROOT}/.carbon/config.json`;

async function setup(files: Record<string, string> = {}) {
  const platform = createMemoryPlatform(files);
  await platform.fs.mkdir(ROOT);
  return platform;
}

describe("vault.id", () => {
  test("is made once, kept in .carbon/config.json and read back", async () => {
    const platform = await setup();
    const vault = await Vault.open(ROOT, platform);
    expect(vault.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(await platform.fs.readText(CONFIG))).toEqual({
      id: vault.id,
    });
    vault.close();
    const again = await Vault.open(ROOT, platform);
    expect(again.id).toBe(vault.id);
    again.close();
  });

  test("differs between vaults", async () => {
    const platform = await setup();
    await platform.fs.mkdir("/w");
    const a = await Vault.open(ROOT, platform);
    const b = await Vault.open("/w", platform);
    expect(a.id).not.toBe(b.id);
    a.close();
    b.close();
  });

  test("keeps what else the config holds", async () => {
    const platform = await setup({ [CONFIG]: '{ "other": 1 }' });
    const vault = await Vault.open(ROOT, platform);
    expect(JSON.parse(await platform.fs.readText(CONFIG))).toEqual({
      other: 1,
      id: vault.id,
    });
    vault.close();
  });

  test("takes an id written by hand", async () => {
    const platform = await setup({ [CONFIG]: '{ "id": "my-vault" }' });
    const vault = await Vault.open(ROOT, platform);
    expect(vault.id).toBe("my-vault");
    vault.close();
  });

  test("leaves a config it cannot read as it is", async () => {
    const platform = await setup({ [CONFIG]: "{ not json" });
    const vault = await Vault.open(ROOT, platform);
    expect(vault.id).not.toBe("");
    expect(await platform.fs.readText(CONFIG)).toBe("{ not json");
    vault.close();
  });
});
