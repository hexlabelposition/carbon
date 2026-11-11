import { Vault, type Platform } from "@carbon/core";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { VaultSessionContext, type VaultSession } from "./vault-session";

interface VaultProviderProps {
  platform: Platform;
  /** Asks the user for a folder. Resolves to `null` if they cancel. */
  pickFolder: () => Promise<string | null>;
  children: ReactNode;
}

/**
 * Owns the open vault. The platform comes in as a prop, so features and
 * shells never import the Tauri adapters themselves.
 */
export function VaultProvider({
  platform,
  pickFolder,
  children,
}: VaultProviderProps) {
  const [vault, setVault] = useState<Vault | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The same vault as in the state, readable from callbacks without making
  // them change on every open.
  const current = useRef<Vault | null>(null);

  const replace = useCallback((next: Vault | null) => {
    current.current?.close();
    current.current = next;
    setVault(next);
  }, []);

  /** Runs one attempt to open a vault; a failure ends up in `error`. */
  const attempt = useCallback(async (action: () => Promise<void>) => {
    setOpening(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setOpening(false);
    }
  }, []);

  const open = useCallback(
    (root: string) =>
      attempt(async () => replace(await Vault.open(root, platform))),
    [attempt, replace, platform],
  );

  const pickAndOpen = useCallback(
    () =>
      attempt(async () => {
        const root = await pickFolder();
        if (root !== null) replace(await Vault.open(root, platform));
      }),
    [attempt, replace, pickFolder, platform],
  );

  const close = useCallback(() => {
    setError(null);
    replace(null);
  }, [replace]);

  const session = useMemo<VaultSession>(
    () => ({ vault, opening, error, pickAndOpen, open, close }),
    [vault, opening, error, pickAndOpen, open, close],
  );

  return <VaultSessionContext value={session}>{children}</VaultSessionContext>;
}
