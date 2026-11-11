import type { IndexStore } from "@carbon/core";

const pending = (): Promise<never> =>
  Promise.reject(new Error("The index store is not implemented yet (C-203)"));

/**
 * Placeholder. The engine is decided (ADR-009: SQLite with FTS5 through the
 * `sql` plugin, in WAL mode, with multi-row inserts). The real store is
 * written in C-203.
 */
export const tauriIndexStore: IndexStore = {
  replaceNote: pending,
  removeNote: pending,
  backlinks: pending,
  search: pending,
};
