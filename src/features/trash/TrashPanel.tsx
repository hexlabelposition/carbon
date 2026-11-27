import type { TrashItem, Vault } from "@carbon/core";
import { useMemo, useRef, type ReactNode } from "react";
import { useLanguage, useT } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { nameOf } from "../vault/paths";
import { placeOf } from "../vault/place";
import { canPreview, type TrashConfirm, type TrashView } from "./use-trash";
import { AppDialog } from "../dialogs/AppDialog";
import { TrashPreview } from "./TrashPreview";
import { sortTrash, trashSortPreference } from "./trash-sort";

/**
 * The trash of the vault: what was deleted, in the order picked
 * (`trashSortPreference`, the latest first at first), each with
 * where it was and when it went. An item can be put back where it was or
 * taken out of the trash, and the whole trash emptied: what is taken out
 * goes to the system trash or is deleted for good, as asked each time.
 * A note or an image opens to be read with a click (`TrashPreview`).
 */
export function TrashPanel({
  vault,
  trash,
}: {
  vault: Vault;
  trash: TrashView;
}) {
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
  const sort = trashSortPreference.use();
  const items = useMemo(
    () => (list.status === "ready" ? sortTrash(list.items, sort) : []),
    [list, sort],
  );
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
      {trash.preview !== null && (
        <TrashPreview
          vault={vault}
          item={trash.preview}
          onRestore={() => {
            const item = trash.preview;
            trash.closePreview();
            if (item !== null) trash.restore(item);
          }}
          onClose={trash.closePreview}
        />
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
            {items.map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-1 rounded-md py-1 pr-1 pl-2 hover:bg-raise"
              >
                <ItemText
                  label={labelOf(item)}
                  muted={item.kind === "file"}
                  details={`${placeOf(item.path, t)} · ${when.format(item.deletedAt)}`}
                  onOpen={canPreview(item) ? () => trash.open(item) : undefined}
                />
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

/**
 * The name of an item and where it was, a button that opens it to read
 * when it can be (a note or an image), plain text otherwise.
 */
function ItemText({
  label,
  muted,
  details,
  onOpen,
}: {
  label: string;
  muted: boolean;
  details: string;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <span className={`block truncate ${muted ? "text-muted" : ""}`}>
        {label}
      </span>
      <span className="block truncate text-small text-faint">{details}</span>
    </>
  );
  if (onOpen === undefined) {
    return <div className="min-w-0 flex-1">{content}</div>;
  }
  return (
    <button
      type="button"
      className="min-w-0 flex-1 cursor-default text-left outline-none focus-visible:underline"
      onClick={onOpen}
    >
      {content}
    </button>
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
          className="size-5"
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
  // The safe answer takes the focus, so a stray Enter deletes nothing for
  // good.
  const toSystem = useRef<HTMLButtonElement>(null);

  const button = "h-8 rounded-md px-3 outline-none focus-visible:ring-2";
  return (
    <AppDialog
      aria-labelledby="trash-confirm-title"
      aria-describedby="trash-confirm-text"
      onClose={trash.cancel}
      initialFocus={toSystem}
      // In the middle of the window, as the settings: a question, not a
      // list that grows down as in the palette.
      className="fixed inset-0 m-auto h-fit w-full max-w-[min(440px,calc(100vw-32px))] rounded-lg border border-line bg-bg p-4 shadow-dialog"
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
    </AppDialog>
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
