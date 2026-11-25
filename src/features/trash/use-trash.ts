import type { TrashItem, Vault } from "@carbon/core";
import { useCallback, useEffect, useState } from "react";
import { useDialog } from "../dialogs/open-dialog";
import { errorText } from "../i18n/error-text";
import { imageTypeOf } from "../image/image-file";

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
  /**
   * Asks what to do with an item, or with everything: to the system
   * trash, or deleted for good.
   */
  askRemove(item: TrashItem): void;
  askEmpty(): void;
  /**
   * What is waiting for an answer, or `null`: asked in a dialog, which
   * closes when another opens.
   */
  confirm: TrashConfirm | null;
  /**
   * Takes what `confirm` names out of the trash: to the system trash with
   * `system`, else deleted for good.
   */
  confirmed(system: boolean): void;
  cancel(): void;
  /**
   * The note or image shown to read (`TrashPreview`), or `null`: in a
   * dialog, which closes when another opens.
   */
  preview: TrashItem | null;
  open(item: TrashItem): void;
  closePreview(): void;
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
  const [asked, setAsked] = useState<TrashConfirm | null>(null);
  const [dialogOpen, setDialogOpen] = useDialog("trashConfirm");
  // Another dialog may have closed this one: then nothing is asked.
  const confirm = dialogOpen ? asked : null;
  const ask = (next: TrashConfirm) => {
    setAsked(next);
    setDialogOpen(true);
  };
  const [shown, setShown] = useState<TrashItem | null>(null);
  const [previewOpen, setPreviewOpen] = useDialog("trashPreview");
  const preview = previewOpen ? shown : null;
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
    askRemove: (item) => ask({ kind: "item", item }),
    askEmpty: () => ask({ kind: "all" }),
    confirm,
    confirmed(system) {
      const current = confirm;
      setDialogOpen(false);
      if (current === null) return;
      run(() =>
        current.kind === "all"
          ? vault.trash.empty({ system })
          : vault.trash.remove(current.item.id, { system }),
      );
    },
    cancel: () => setDialogOpen(false),
    preview,
    open(item) {
      setShown(item);
      setPreviewOpen(true);
    },
    closePreview: () => setPreviewOpen(false),
    error,
    dismiss: () => setError(null),
  };
}

/** Whether an item of the trash can be looked at: a note or an image. */
export function canPreview(item: TrashItem): boolean {
  return (
    item.kind === "note" ||
    (item.kind === "file" && imageTypeOf(item.path) !== null)
  );
}

function messageOf(reason: unknown): string {
  return errorText(reason);
}
