import { describe, expect, test } from "bun:test";
import {
  checkVaultName,
  Vault,
  VaultError,
  WriteConflictError,
  type VaultErrorCode,
} from "../src/index";
import { createMemoryPlatform } from "./fakes";

async function openVault() {
  const platform = createMemoryPlatform({
    "/vault/Inbox.md": "# Inbox",
    "/vault/projects/Carbon.md": "carbon",
  });
  return Vault.open("/vault", platform);
}

/** What `run` failed with, as the interface reads it. */
async function failure(
  run: () => unknown,
): Promise<{ code: VaultErrorCode; subject: string }> {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof VaultError)) throw error;
    return { code: error.code, subject: error.subject };
  }
  throw new Error("It did not fail");
}

describe("VaultError", () => {
  test("tells a taken path by its code and the path", async () => {
    const vault = await openVault();
    expect(await failure(() => vault.notes.create("Inbox.md"))).toEqual({
      code: "alreadyExists",
      subject: "Inbox.md",
    });
  });

  test("tells a path that leaves the vault", async () => {
    const vault = await openVault();
    expect(await failure(() => vault.notes.read("../secret.md"))).toEqual({
      code: "invalidPath",
      subject: "../secret.md",
    });
  });

  test("tells a hidden name and a folder moved into itself", async () => {
    const vault = await openVault();
    expect((await failure(() => vault.notes.create(".hidden.md"))).code).toBe(
      "hiddenName",
    );
    expect(
      await failure(() => vault.folders.rename("projects", "projects/inner")),
    ).toEqual({ code: "moveIntoItself", subject: "projects" });
  });

  test("tells a vault name that cannot be used, as typed", async () => {
    expect(await failure(() => checkVaultName("a/b"))).toEqual({
      code: "invalidVaultName",
      subject: "a/b",
    });
  });

  test("keeps the English message for logs", async () => {
    const vault = await openVault();
    await expect(vault.notes.create("Inbox.md")).rejects.toThrow(
      "Already exists: Inbox.md",
    );
  });

  test("a write conflict is one of them", () => {
    const error = new WriteConflictError("Inbox.md");
    expect(error).toBeInstanceOf(VaultError);
    expect(error.code).toBe("writeConflict");
    expect(error.subject).toBe("Inbox.md");
  });
});
