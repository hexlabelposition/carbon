import { checkVaultName, Vault, type Platform } from "@carbon/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t } from "../i18n/i18n";
import { useAppSettings } from "../settings/app-settings";
import {
  VaultSessionContext,
  type VaultError,
  type VaultSession,
} from "./vault-session";
import { timing } from "./timing";
import { errorText } from "../i18n/error-text";

interface VaultProviderProps {
  platform: Platform;
  /** Asks the user for a folder. Resolves to `null` if they cancel. */
  pickFolder: (title?: string) => Promise<string | null>;
  children: ReactNode;
}

/**
 * Owns the open vault. The platform comes in as a prop, so features and
 * shells never import the Tauri adapters themselves. At start it opens the
 * vault that was open when the app was closed; a vault the user closed is
 * not opened again, the start screen is shown.
 */
export function VaultProvider({
  platform,
  pickFolder,
  children,
}: VaultProviderProps) {
  const settings = useAppSettings();
  const { addRecentVault, setOpenVault } = settings;
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
   * `null` if the user cancelled; a failure ends up in `error`. Resolves
   * with whether a vault was opened.
   */
  const attempt = useCallback(
    async (
      root: string | null,
      action: () => Promise<Vault | null>,
      remember = true,
    ) => {
      setOpening(true);
      setError(null);
      try {
        const opened = await action();
        if (opened === null) return false;
        replace(opened);
        if (remember) void addRecentVault(opened.root);
        // A vault made afresh each time, as the test vault, is not opened
        // again at the next start: the start screen is.
        void setOpenVault(remember ? opened.root : null);
        return true;
      } catch (reason) {
        const message = errorText(reason);
        setError({ message, root });
        return false;
      } finally {
        setOpening(false);
      }
    },
    [replace, addRecentVault, setOpenVault],
  );

  /** Opens a vault, noting when for the timings (C-602). */
  const openVault = useCallback(
    (root: string) => {
      timing.openedAt = performance.now();
      return Vault.open(root, platform);
    },
    [platform],
  );

  const open = useCallback(
    async (root: string) => {
      await attempt(root, () => openVault(root));
    },
    [attempt, openVault],
  );

  // At start, once the settings are read: the vault left open, if any.
  // `leftOpen` is what the settings held at start, it does not change.
  const { loaded, openVault: leftOpen } = settings;
  const [restoreDone, setRestoreDone] = useState(false);
  const restoring = !loaded || (leftOpen !== null && !restoreDone);
  const restoreStarted = useRef(false);
  useEffect(() => {
    if (!loaded || leftOpen === null || restoreStarted.current) return;
    restoreStarted.current = true;
    void attempt(leftOpen, () => openVault(leftOpen)).then((opened) => {
      // Gone or not reachable: the start screen tells why, and the next
      // start does not try again.
      if (!opened) void setOpenVault(null);
      setRestoreDone(true);
    });
  }, [loaded, leftOpen, attempt, openVault, setOpenVault]);

  const pickAndOpen = useCallback(async () => {
    await attempt(null, async () => {
      const root = await pickFolder(t("vault.pickOpen"));
      return root === null ? null : openVault(root);
    });
  }, [attempt, pickFolder, openVault]);

  const pickAndCreate = useCallback(
    async (name: string) => {
      await attempt(null, async () => {
        // Before the dialog: a bad name should not cost the user a pick.
        checkVaultName(name);
        const parent = await pickFolder(t("vault.pickCreate", { name }));
        return parent === null ? null : Vault.create(parent, name, platform);
      });
    },
    [attempt, pickFolder, platform],
  );

  const openPrepared = useCallback(
    async (prepare: () => Promise<string>) => {
      await attempt(null, async () => openVault(await prepare()), false);
    },
    [attempt, openVault],
  );

  // The user left the vault: the next start shows the start screen.
  const close = useCallback(() => {
    setError(null);
    replace(null);
    void setOpenVault(null);
  }, [replace, setOpenVault]);

  const clearError = useCallback(() => setError(null), []);

  const session = useMemo<VaultSession>(
    () => ({
      vault,
      opening,
      restoring,
      error,
      pickAndOpen,
      pickAndCreate,
      open,
      openPrepared,
      close,
      clearError,
    }),
    [
      vault,
      opening,
      restoring,
      error,
      pickAndOpen,
      pickAndCreate,
      open,
      openPrepared,
      close,
      clearError,
    ],
  );

  return <VaultSessionContext value={session}>{children}</VaultSessionContext>;
}
