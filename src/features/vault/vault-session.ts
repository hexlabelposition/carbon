import type { Vault } from "@carbon/core";
import { createContext, useContext } from "react";

/** The vault the app is working with, and how to change it. */
export interface VaultSession {
  /** The open vault, or `null` before one is opened and after `close`. */
  vault: Vault | null;
  /** True while a folder is being picked, created or opened. */
  opening: boolean;
  /**
   * True at start while the vault that was open when the app was closed
   * is opened again: neither it nor the start screen is shown yet.
   */
  restoring: boolean;
  /** Why the last attempt to open a vault failed. */
  error: VaultError | null;
  /** Asks the user for a folder and opens it. Does nothing if cancelled. */
  pickAndOpen(): Promise<void>;
  /**
   * Asks the user where to put a new vault, creates the folder `name` there
   * and opens it. Does nothing if cancelled.
   */
  pickAndCreate(name: string): Promise<void>;
  /** Opens the folder at `root`, closing the current vault on success. */
  open(root: string): Promise<void>;
  /**
   * Makes the sandbox afresh, sample notes to try the app in, and opens
   * it. It is not put on the recent list, nor opened again at the next
   * start: nothing done in it is kept.
   */
  openSandbox(): Promise<void>;
  close(): void;
  /** Forgets the last failure. */
  clearError(): void;
}

export interface VaultError {
  /** In words for the user. */
  message: string;
  /** The folder that could not be opened, if the attempt got that far. */
  root: string | null;
  /** The folder is not there: moved or deleted since it was last open. */
  missing: boolean;
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
