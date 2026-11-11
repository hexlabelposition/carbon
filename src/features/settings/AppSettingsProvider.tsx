import {
  AppSettings,
  type NotePath,
  type RecentVault,
  type SettingsStore,
} from "@carbon/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppSettingsContext, type AppSettingsState } from "./app-settings";

interface AppSettingsProviderProps {
  store: SettingsStore;
  children: ReactNode;
}

const NO_VAULTS: readonly RecentVault[] = [];

/** Loads the app settings once and keeps the UI in step with them. */
export function AppSettingsProvider({
  store,
  children,
}: AppSettingsProviderProps) {
  // Resolves to `null` if the settings cannot be read: the app then works
  // without them and saves nothing, so it cannot overwrite what is there.
  const [ready] = useState(() =>
    AppSettings.load(store).catch((reason: unknown) => {
      console.error("Could not load the app settings", reason);
      return null;
    }),
  );
  const [loaded, setLoaded] = useState(false);
  const [recentVaults, setRecentVaults] = useState(NO_VAULTS);

  useEffect(() => {
    let cancelled = false;
    void ready.then((settings) => {
      if (cancelled) return;
      setRecentVaults(settings?.recentVaults ?? NO_VAULTS);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  /** Applies a change, then shows its result even if saving it failed. */
  const change = useCallback(
    async (apply: (settings: AppSettings) => Promise<void>) => {
      const settings = await ready;
      if (settings === null) return;
      try {
        await apply(settings);
      } catch (reason) {
        console.error("Could not save the app settings", reason);
      }
      setRecentVaults(settings.recentVaults);
    },
    [ready],
  );

  const addRecentVault = useCallback(
    (root: string) => change((s) => s.addRecentVault(root)),
    [change],
  );
  const removeRecentVault = useCallback(
    (root: string) => change((s) => s.removeRecentVault(root)),
    [change],
  );
  const setLastOpenedNote = useCallback(
    (root: string, note: NotePath | null) =>
      change((s) => s.setLastOpenedNote(root, note)),
    [change],
  );

  const state = useMemo<AppSettingsState>(
    () => ({
      loaded,
      recentVaults,
      addRecentVault,
      removeRecentVault,
      setLastOpenedNote,
    }),
    [
      loaded,
      recentVaults,
      addRecentVault,
      removeRecentVault,
      setLastOpenedNote,
    ],
  );

  return <AppSettingsContext value={state}>{children}</AppSettingsContext>;
}
