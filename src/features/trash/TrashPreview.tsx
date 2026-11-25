import type { TrashItem, Vault } from "@carbon/core";
import { useEffect, useState } from "react";
import { AppDialog } from "../dialogs/AppDialog";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { errorText } from "../i18n/error-text";
import { useT } from "../i18n/i18n";
import { FittedImage } from "../image/FittedImage";
import { imageTypeOf } from "../image/image-file";
import { entryLabel } from "../vault/place";

type Loaded =
  | { status: "loading" }
  | { status: "note"; text: string }
  | { status: "image"; url: string }
  | { status: "error"; message: string };

/**
 * A note or an image of the trash, shown to read before it is restored:
 * a note as in reading mode, an image whole. It cannot be changed there;
 * "Restore" puts it back where it was, to be opened as any other.
 */
export function TrashPreview({
  vault,
  item,
  onRestore,
  onClose,
}: {
  vault: Vault;
  item: TrashItem;
  onRestore: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const loaded = useTrashFile(vault, item);
  const name = entryLabel(item.path);

  return (
    <AppDialog
      aria-label={name}
      onClose={onClose}
      className="fixed inset-0 m-auto flex h-[min(80vh,860px)] w-full max-w-[min(860px,calc(100vw-32px))] flex-col overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line pr-1.5 pl-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">{name}</h2>
        </div>
        <span className="shrink-0 text-small text-faint">
          {t("trash.readOnly")}
        </span>
        <button
          type="button"
          className="h-7 shrink-0 rounded-md bg-raise px-2.5 outline-none hover:bg-selected focus-visible:ring-2 focus-visible:ring-line-strong"
          onClick={onRestore}
        >
          {t("trash.restore")}
        </button>
        <button
          type="button"
          aria-label={t("common.close")}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted outline-none hover:bg-selected hover:text-fg focus-visible:ring-2 focus-visible:ring-line-strong"
          onClick={onClose}
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          >
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
          </svg>
        </button>
      </header>
      <div
        className="min-h-0 flex-1 overflow-auto"
        // A task cannot be ticked here: the note is not saved from the
        // trash. Taken before the checkbox sees the press.
        onMouseDownCapture={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest(".cm-task") !== null
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {loaded.status === "note" && (
          <div className="flex min-h-full flex-col pt-8">
            <MarkdownEditor
              text={loaded.text}
              revision={0}
              label={name}
              readOnly
            />
          </div>
        )}
        {loaded.status === "image" && (
          <FittedImage url={loaded.url} alt={name} />
        )}
        {loaded.status === "error" && (
          <p
            role="alert"
            className="flex h-full items-center justify-center px-8 text-center text-danger"
          >
            {t("start.couldNotOpen", {
              root: item.path,
              reason: loaded.message,
            })}
          </p>
        )}
      </div>
    </AppDialog>
  );
}

/** Reads the note or image of a trash item, once for each item. */
function useTrashFile(vault: Vault, item: TrashItem): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  useEffect(() => {
    let current = true;
    let url: string | null = null;
    const failed = (reason: unknown) => {
      if (current) setLoaded({ status: "error", message: errorText(reason) });
    };
    if (item.kind === "note") {
      vault.trash.readText(item.id).then((text) => {
        if (current) setLoaded({ status: "note", text });
      }, failed);
    } else {
      const type = imageTypeOf(item.path) ?? "application/octet-stream";
      vault.trash.readBytes(item.id).then((bytes) => {
        if (!current) return;
        url = URL.createObjectURL(new Blob([bytes.slice()], { type }));
        setLoaded({ status: "image", url });
      }, failed);
    }
    return () => {
      current = false;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [vault, item]);
  return loaded;
}
