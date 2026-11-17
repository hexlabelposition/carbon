import { DRAFTS_FOLDER, type TrashItem } from "@carbon/core";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLanguage, useT, type Translate } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { nameOf, parentOf } from "../vault/paths";
import type { TrashConfirm, TrashView } from "./use-trash";

/**
 * The trash of the vault: what was deleted, the latest first, each with
 * where it was and when it went. An item can be put back where it was or
 * taken out of the trash, and the whole trash emptied: what is taken out
 * goes to the system trash or is deleted for good, as asked each time.
 */
export function TrashPanel({ trash }: { trash: TrashView }) {
  const t = useT();
  const language = useLanguage();
  const when = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [language],
  );
  const { list } = trash;
  if (list.status === "loading") return null;
  if (list.status === "error") {
    return (
      <p className="px-3 py-2 text-small text-danger">
        {t("trash.failed", { reason: list.message })}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Notice trash={trash} />
      {trash.confirm !== null && (
        <ConfirmDialog trash={trash} confirm={trash.confirm} />
      )}
      {list.items.length === 0 ? (
        <p className="px-3 py-4 text-center text-faint">{t("trash.empty")}</p>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2 pb-1 text-small text-faint">
            <span>{t("trash.count", { count: list.items.length })}</span>
            <button
              type="button"
              className="rounded-sm px-1 text-muted hover:bg-raise hover:text-danger"
              onClick={trash.askEmpty}
            >
              {t("trash.emptyAll")}
            </button>
          </div>
          <ul
            aria-label={t("shell.trash")}
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 pb-2"
          >
            {list.items.map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-1 rounded-md py-1 pr-1 pl-2 hover:bg-raise"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate ${item.kind === "file" ? "text-muted" : ""}`}
                  >
                    {labelOf(item)}
                  </p>
                  <p className="truncate text-small text-faint">
                    {placeOf(item, t)} · {when.format(item.deletedAt)}
                  </p>
                </div>
                <RowButton
                  label={t("trash.restore")}
                  onClick={() => trash.restore(item)}
                >
                  <path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H6M5.5 4L3 6.5 5.5 9" />
                </RowButton>
                <RowButton
                  label={t("trash.discard")}
                  danger
                  onClick={() => trash.askRemove(item)}
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </RowButton>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** A small button of a row, seen while the row is hovered or focused. */
function RowButton({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        className={`flex size-6 shrink-0 items-center justify-center rounded-sm text-muted opacity-0 outline-none group-hover:opacity-100 hover:bg-selected focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-line-strong ${
          danger ? "hover:text-danger" : "hover:text-fg"
        }`}
        onClick={onClick}
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </svg>
      </button>
    </Tooltip>
  );
}

/**
 * What to do with an item, or with everything, that leaves the trash: to
 * the system trash, which has the focus, or deleted for good. Laid out
 * over a blurred window, as the other dialogs; Escape or a click outside
 * keeps it all.
 */
function ConfirmDialog({
  trash,
  confirm,
}: {
  trash: TrashView;
  confirm: TrashConfirm;
}) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const toSystem = useRef<HTMLButtonElement>(null);

  // A modal `<dialog>` keeps the focus inside and closes on Escape.
  useEffect(() => {
    const element = dialog.current;
    if (element === null || element.open) return;
    element.showModal();
    // After `showModal`, which gives the focus to the first button: the
    // safe answer takes it, so a stray Enter deletes nothing for good.
    toSystem.current?.focus();
    return () => element.close();
  }, []);

  const button = "h-8 rounded-md px-3 outline-none focus-visible:ring-2";
  return (
    <dialog
      ref={dialog}
      aria-labelledby="trash-confirm-title"
      aria-describedby="trash-confirm-text"
      // In the middle of the window, as the settings: a question, not a
      // list that grows down as in the palette.
      className="m-auto w-full max-w-[440px] rounded-lg border border-line bg-bg p-4 text-ui text-fg shadow-dialog backdrop:top-bar backdrop:bg-backdrop/40 backdrop:backdrop-blur-xs"
      onCancel={(event) => {
        event.preventDefault();
        trash.cancel();
      }}
      // A click on the backdrop lands on the dialog itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) trash.cancel();
      }}
    >
      <h2 id="trash-confirm-title" className="font-medium">
        {confirm.kind === "all"
          ? t("trash.emptyAll")
          : t("trash.discardTitle", { name: labelOf(confirm.item) })}
      </h2>
      <p id="trash-confirm-text" className="mt-1.5 text-muted">
        {t(
          confirm.kind === "all" ? "trash.confirmEmpty" : "trash.confirmDelete",
        )}
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={`${button} border border-line-strong hover:bg-raise focus-visible:ring-line-strong`}
          onClick={trash.cancel}
        >
          {t("trash.cancel")}
        </button>
        <button
          ref={toSystem}
          type="button"
          className={`${button} bg-raise hover:bg-selected focus-visible:ring-line-strong`}
          onClick={() => trash.confirmed(true)}
        >
          {t("trash.toSystem")}
        </button>
        <button
          type="button"
          className={`${button} bg-danger text-on-danger focus-visible:ring-line-strong`}
          onClick={() => trash.confirmed(false)}
        >
          {t("trash.deleteForGood")}
        </button>
      </div>
    </dialog>
  );
}

/** What went wrong with the last action, until dismissed. */
function Notice({ trash }: { trash: TrashView }) {
  const t = useT();
  if (trash.error !== null) {
    return (
      <div
        role="alert"
        className="flex shrink-0 items-start gap-2 border-b border-line px-3 py-2 text-small"
      >
        <p className="min-w-0 flex-1 text-danger">{trash.error}</p>
        <button
          type="button"
          className="shrink-0 rounded-sm px-1 text-muted hover:bg-raise hover:text-fg"
          onClick={trash.dismiss}
        >
          {t("common.dismiss")}
        </button>
      </div>
    );
  }
  return null;
}

/** How an item is named: a note without its `.md`, as in the file tree. */
function labelOf(item: TrashItem): string {
  const name = nameOf(item.path);
  return item.kind === "note" ? name.replace(/\.md$/i, "") : name;
}

/** Where an item was: a folder, the vault root, or the drafts. */
function placeOf(item: TrashItem, t: Translate): string {
  const folder = parentOf(item.path);
  if (folder === DRAFTS_FOLDER) return t("shell.drafts");
  if (folder.startsWith(`${DRAFTS_FOLDER}/`)) {
    return `${t("shell.drafts")}/${folder.slice(DRAFTS_FOLDER.length + 1)}`;
  }
  return folder === "" ? t("trash.root") : folder;
}
