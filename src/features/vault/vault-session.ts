import type { Vault } from "@carbon/core";
import { createContext, useContext } from "react";

/** The vault the app is working with, and how to change it. */
export interface VaultSession {
  /** The open vault, or `null` before one is opened and after `close`. */
  vault: Vault | null;
  /** True while a folder is being picked or opened. */
  opening: boolean;
  /** Why the last attempt to open a vault failed, in words for the user. */
  error: string | null;
  /** Asks the user for a folder and opens it. Does nothing if cancelled. */
  pickAndOpen(): Promise<void>;
  /** Opens the folder at `root`, closing the current vault on success. */
  open(root: string): Promise<void>;
  close(): void;
}

export const VaultSessionContext = createContext<VaultSession | null>(null);

/** The vault session of the app. Needs a `VaultProvider` above. */
export function useVaultSession(): VaultSession {
  const session = useContext(VaultSessionContext);
  if (session === null) {
    throw new Error("useVaultSession needs a VaultProvider above it");
  }
  return session;
}
