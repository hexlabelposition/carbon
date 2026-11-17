import { DRAFTS_FOLDER, type TrashItem } from "@carbon/core";
import { useMemo, type ReactNode } from "react";
import { useLanguage, useT, type Translate } from "../i18n/i18n";
import { Tooltip } from "../ui/Tooltip";
import { nameOf, parentOf } from "../vault/paths";
import type { TrashView } from "./use-trash";

/**
 * The trash of the vault: what was deleted, the latest first, each with
 * where it was and when it went. An item can be put back where it was or
 * deleted for good; the whole trash can be emptied. Deleting for good
 * asks first.
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
                  label={t("trash.deleteForGood")}
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

/** The question before deleting for good, or what went wrong. */
function Notice({ trash }: { trash: TrashView }) {
  const t = useT();
  const { confirm } = trash;
  if (confirm !== null) {
    return (
      <div
        role="alert"
        className="flex shrink-0 flex-col gap-1.5 border-b border-line px-3 py-2 text-small"
      >
        <p>
          {confirm.kind === "all"
            ? t("trash.confirmEmpty")
            : t("trash.confirmDelete", { name: labelOf(confirm.item) })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-6 rounded-sm bg-danger px-2 text-on-danger"
            onClick={trash.confirmed}
          >
            {t(
              confirm.kind === "all" ? "trash.emptyAll" : "tree.deleteForGood",
            )}
          </button>
          <button
            type="button"
            className="h-6 rounded-sm border border-line-strong px-2"
            onClick={trash.cancel}
          >
            {t("trash.cancel")}
          </button>
        </div>
      </div>
    );
  }
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
