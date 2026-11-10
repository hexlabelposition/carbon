import type { IndexStore } from "@carbon/core";

const pending = (): Promise<never> =>
  Promise.reject(
    new Error("The index store is not implemented yet (C-009, C-203)"),
  );

/**
 * Placeholder. The engine is chosen in C-009 after the measurements in C-007
 * and C-008, and the real store is written in C-203. The `sql` plugin is
 * already registered so those tasks can use it.
 */
export const tauriIndexStore: IndexStore = {
  replaceNote: pending,
  removeNote: pending,
  backlinks: pending,
  search: pending,
};
