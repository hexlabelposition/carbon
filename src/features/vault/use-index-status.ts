import type { IndexStatus, Vault } from "@carbon/core";
import { useCallback, useSyncExternalStore } from "react";

/** Where the index of the vault is, kept up to date. */
export function useIndexStatus(vault: Vault): IndexStatus {
  const subscribe = useCallback(
    (changed: () => void) => {
      let current = true;
      // A failure sends no event; `indexed()` rejects instead.
      vault.indexed().catch(() => {
        if (current) changed();
      });
      const stops = [
        vault.on("index:progress", changed),
        vault.on("index:ready", changed),
      ];
      return () => {
        current = false;
        for (const stop of stops) stop();
      };
    },
    [vault],
  );
  return useSyncExternalStore(subscribe, () => vault.indexStatus);
}
