import { useEffect, useSyncExternalStore } from "react";
import { preference } from "../settings/preference";

/** A newer version of the app, ready to install. */
export interface AvailableUpdate {
  version: string;
  /** What is new, as the release says it; may be empty. */
  notes: string;
  /**
   * Downloads and installs it. `onProgress` gets the part downloaded,
   * from 0 to 1, or `null` while the size is unknown. On Windows the
   * installer closes the app before this resolves.
   */
  install(onProgress: (part: number | null) => void): Promise<void>;
}

/** Where updates come from: the platform gives it (ADR-034). */
export interface Updater {
  /** The newer version, if there is one; rejects when it cannot tell. */
  check(): Promise<AvailableUpdate | null>;
  /** Starts the app again, as installed now. */
  restart(): Promise<void>;
}

/**
 * Whether the app looks for a newer version when it starts: on until
 * turned off, the one time Carbon goes to the network by itself.
 */
export const checkAtStartPreference = preference<boolean>(
  "carbon.updates.checkAtStart",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

// What must be done before an update closes the app: the unsaved edits.
const beforeInstall = new Set<() => Promise<void>>();

/**
 * Runs `task` before an update is installed, while the component is
 * mounted: the app is closed right after, on Windows even before the
 * download is over. `task` should be stable, as from `useCallback`.
 */
export function useBeforeUpdate(task: () => Promise<void>): void {
  useEffect(() => {
    beforeInstall.add(task);
    return () => {
      beforeInstall.delete(task);
    };
  }, [task]);
}

/** Runs what `useBeforeUpdate` registered; a task that fails is skipped. */
export async function runBeforeUpdate(): Promise<void> {
  await Promise.allSettled([...beforeInstall].map((task) => task()));
}

// The check asked for by hand, from the settings or the palette: the
// mounted `Updates` takes it.
let checkByHand: (() => void) | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Sets what `checkForUpdates` runs; `null` when nothing can. */
export function setCheckByHand(run: (() => void) | null): void {
  checkByHand = run;
  for (const listener of listeners) listener();
}

/** Looks for a newer version now and shows what was found. */
export function checkForUpdates(): void {
  checkByHand?.();
}

/** Whether updates can be looked for: not in a dev build. */
export function useCanCheckForUpdates(): boolean {
  return useSyncExternalStore(subscribe, () => checkByHand !== null);
}
