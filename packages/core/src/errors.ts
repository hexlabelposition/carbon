/** What went wrong, for the interface to tell in its own language. */
export type VaultErrorCode =
  | "invalidVaultRoot"
  | "invalidVaultName"
  | "invalidPath"
  | "hiddenName"
  | "indexNotOpen"
  | "notAFolder"
  | "notAFile"
  | "alreadyExists"
  | "mentionGone"
  | "notInTrash"
  | "notATag"
  | "noteNotIndexed"
  | "badGraphDepth"
  | "moveIntoItself"
  | "copyIntoItself"
  | "outsideVault"
  | "writeConflict";

/**
 * An error of the core that the interface can tell in its language: what
 * went wrong as a `code`, and what it went wrong with, a path or a name,
 * as `subject`. The `message` stays English, for logs and the console
 * (ADR-025).
 */
export class VaultError extends Error {
  constructor(
    readonly code: VaultErrorCode,
    readonly subject: string,
    message: string,
  ) {
    super(message);
    this.name = "VaultError";
  }
}
