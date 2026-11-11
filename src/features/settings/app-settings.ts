import type { NotePath, RecentVault } from "@carbon/core";
import { createContext, useContext } from "react";

/** The app settings as the UI sees them. */
export interface AppSettingsState {
  /** False until the saved settings have been read. */
  loaded: boolean;
  /** Vaults that were opened on this device, the latest first. */
  recentVaults: readonly RecentVault[];
  /**
   * The changes below are saved in the background. They never reject: a
   * save that fails must not break what the user is doing.
   */
  addRecentVault(root: string): Promise<void>;
  removeRecentVault(root: string): Promise<void>;
  /** Remembers the open note of a vault; `null` when none is open. */
  setLastOpenedNote(root: string, note: NotePath | null): Promise<void>;
}

export const AppSettingsContext = createContext<AppSettingsState | null>(null);

/** The app settings. Needs an `AppSettingsProvider` above. */
export function useAppSettings(): AppSettingsState {
  const state = useContext(AppSettingsContext);
  if (state === null) {
    throw new Error("useAppSettings needs an AppSettingsProvider above it");
  }
  return state;
}
