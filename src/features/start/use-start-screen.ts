import type { RecentVault } from "@carbon/core";
import { useCallback, useState } from "react";
import { useAppSettings } from "../settings/app-settings";
import { useVaultSession, type VaultError } from "../vault/vault-session";

export interface StartScreenState {
  /** True while a vault is being picked, created or opened. */
  busy: boolean;
  error: VaultError | null;
  /** Recent vaults, the latest first. Empty until the settings are read. */
  recentVaults: readonly RecentVault[];
  openFolder(): void;
  openRecent(root: string): void;
  /** Takes a vault off the recent list. Its folder is not touched. */
  forgetRecent(root: string): void;

  /** Whether the form for a new vault is shown. */
  creating: boolean;
  /** The name typed for the new vault. */
  name: string;
  /** False while `name` is empty: there is nothing to create yet. */
  canCreate: boolean;
  startCreating(): void;
  cancelCreating(): void;
  setName(name: string): void;
  /** Asks where to put the new vault, then creates and opens it. */
  create(): void;
}

/** Everything the start screen does; the component only shows it. */
export function useStartScreen(): StartScreenState {
  const session = useVaultSession();
  const settings = useAppSettings();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const { pickAndOpen, pickAndCreate, open, clearError } = session;
  const { removeRecentVault } = settings;
  const trimmed = name.trim();

  const forgetRecent = useCallback(
    (root: string) => {
      void removeRecentVault(root);
      // The failure on screen may be about the vault that was just removed.
      clearError();
    },
    [removeRecentVault, clearError],
  );

  return {
    busy: session.opening,
    error: session.error,
    recentVaults: settings.recentVaults,
    openFolder: () => void pickAndOpen(),
    openRecent: (root) => void open(root),
    forgetRecent,

    creating,
    name,
    canCreate: trimmed !== "",
    startCreating: () => setCreating(true),
    cancelCreating: () => {
      setCreating(false);
      setName("");
      clearError();
    },
    setName,
    create: () => {
      if (trimmed !== "") void pickAndCreate(trimmed);
    },
  };
}
