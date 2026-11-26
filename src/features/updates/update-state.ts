import { useEffect, useSyncExternalStore } from "react";
import { preference } from "../settings/preference";

/** A newer version of the app, ready to install. */
export interface AvailableUpdate {
  version: string;
  /** What is new, as the release says it; may be empty. */
  notes: string;
  /**
   * Whether `install` can put it in place: not for an install made by a
   * system package, such as the Arch one, which is updated by a new
   * package.
   */
  installable: boolean;
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

/** What the last look for a newer version found. */
export type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "upToDate" }
  | { kind: "available"; update: AvailableUpdate }
  | { kind: "failed"; message: string };

// Shared by the settings, which show it in a row, and the dialog.
let checkState: CheckState = { kind: "idle" };
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function changed() {
  for (const listener of listeners) listener();
}

export function setCheckState(next: CheckState): void {
  checkState = next;
  changed();
}

export function getCheckState(): CheckState {
  return checkState;
}

/** What the last look found, kept up to date in a component. */
export function useCheckState(): CheckState {
  return useSyncExternalStore(subscribe, () => checkState);
}

/** What the mounted `Updates` does when asked from elsewhere. */
export interface UpdateActions {
  /** Looks for a newer version; the result goes to `useCheckState`. */
  check(): void;
  /** Opens the dialog that installs the update found. */
  showUpdate(): void;
}

let actions: UpdateActions | null = null;

/** Sets what the functions below run; `null` when nothing can. */
export function setUpdateActions(next: UpdateActions | null): void {
  actions = next;
  changed();
}

/** Looks for a newer version now, without a dialog. */
export function checkForUpdates(): void {
  actions?.check();
}

/** Opens the dialog that installs the update found. */
export function showUpdate(): void {
  actions?.showUpdate();
}

/** Whether updates can be looked for: not in a dev build. */
export function useCanCheckForUpdates(): boolean {
  return useSyncExternalStore(subscribe, () => actions !== null);
}
