import type { TrashItem, Vault } from "@carbon/core";
import { useCallback, useEffect, useState } from "react";

export type TrashListState =
  | { status: "loading" }
  | { status: "ready"; items: readonly TrashItem[] }
  | { status: "error"; message: string };

/** What is waiting to be deleted for good: one item, or all of them. */
export type TrashConfirm = { kind: "item"; item: TrashItem } | { kind: "all" };

export interface TrashView {
  list: TrashListState;
  /** Puts an item back where it was (`VaultTrash.restore`). */
  restore(item: TrashItem): void;
  /** Asks before deleting an item, or everything, for good. */
  askRemove(item: TrashItem): void;
  askEmpty(): void;
  /** What is waiting for a yes, or `null`. */
  confirm: TrashConfirm | null;
  /** Deletes for good what `confirm` names. */
  confirmed(): void;
  cancel(): void;
  /** The last thing that went wrong, in words for the user. */
  error: string | null;
  dismiss(): void;
}

/**
 * The trash of the vault (ADR-031), while `enabled`: asked for only while
 * it is shown, and again whenever it changes.
 */
export function useTrash(vault: Vault, enabled: boolean): TrashView {
  const [list, setList] = useState<TrashListState>({ status: "loading" });
  const [confirm, setConfirm] = useState<TrashConfirm | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Raised to ask for the list again. */
  const [version, setVersion] = useState(0);

  useEffect(() => vault.on("trash", () => setVersion((v) => v + 1)), [vault]);

  useEffect(() => {
    if (!enabled) return;
    // An older answer must not replace a newer one.
    let stale = false;
    vault.trash.list().then(
      (items) => {
        if (!stale) setList({ status: "ready", items });
      },
      (reason: unknown) => {
        if (!stale) setList({ status: "error", message: messageOf(reason) });
      },
    );
    return () => {
      stale = true;
    };
  }, [vault, enabled, version]);

  const run = useCallback((action: () => Promise<unknown>) => {
    setError(null);
    action().catch((reason: unknown) => setError(messageOf(reason)));
  }, []);

  return {
    list,
    restore: (item) => run(() => vault.trash.restore(item.id)),
    askRemove: (item) => setConfirm({ kind: "item", item }),
    askEmpty: () => setConfirm({ kind: "all" }),
    confirm,
    confirmed() {
      const current = confirm;
      setConfirm(null);
      if (current === null) return;
      run(() =>
        current.kind === "all"
          ? vault.trash.empty()
          : vault.trash.remove(current.item.id),
      );
    },
    cancel: () => setConfirm(null),
    error,
    dismiss: () => setError(null),
  };
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
