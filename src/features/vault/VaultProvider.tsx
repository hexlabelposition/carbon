import { checkVaultName, Vault, type Platform } from "@carbon/core";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppSettings } from "../settings/app-settings";
import {
  VaultSessionContext,
  type VaultError,
  type VaultSession,
} from "./vault-session";

interface VaultProviderProps {
  platform: Platform;
  /** Asks the user for a folder. Resolves to `null` if they cancel. */
  pickFolder: (title?: string) => Promise<string | null>;
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
  const { addRecentVault } = useAppSettings();
  const [vault, setVault] = useState<Vault | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<VaultError | null>(null);
  // The same vault as in the state, readable from callbacks without making
  // them change on every open.
  const current = useRef<Vault | null>(null);

  const replace = useCallback((next: Vault | null) => {
    current.current?.close();
    current.current = next;
    setVault(next);
  }, []);

  /**
   * Runs one attempt to get a vault. `action` resolves to the vault, or to
   * `null` if the user cancelled; a failure ends up in `error`.
   */
  const attempt = useCallback(
    async (root: string | null, action: () => Promise<Vault | null>) => {
      setOpening(true);
      setError(null);
      try {
        const opened = await action();
        if (opened === null) return;
        replace(opened);
        void addRecentVault(opened.root);
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setError({ message, root });
      } finally {
        setOpening(false);
      }
    },
    [replace, addRecentVault],
  );

  const open = useCallback(
    (root: string) => attempt(root, () => Vault.open(root, platform)),
    [attempt, platform],
  );

  const pickAndOpen = useCallback(
    () =>
      attempt(null, async () => {
        const root = await pickFolder("Open a vault folder");
        return root === null ? null : Vault.open(root, platform);
      }),
    [attempt, pickFolder, platform],
  );

  const pickAndCreate = useCallback(
    (name: string) =>
      attempt(null, async () => {
        // Before the dialog: a bad name should not cost the user a pick.
        checkVaultName(name);
        const parent = await pickFolder(`Choose where to create “${name}”`);
        return parent === null ? null : Vault.create(parent, name, platform);
      }),
    [attempt, pickFolder, platform],
  );

  const close = useCallback(() => {
    setError(null);
    replace(null);
  }, [replace]);

  const clearError = useCallback(() => setError(null), []);

  const session = useMemo<VaultSession>(
    () => ({
      vault,
      opening,
      error,
      pickAndOpen,
      pickAndCreate,
      open,
      close,
      clearError,
    }),
    [
      vault,
      opening,
      error,
      pickAndOpen,
      pickAndCreate,
      open,
      close,
      clearError,
    ],
  );

  return <VaultSessionContext value={session}>{children}</VaultSessionContext>;
}
