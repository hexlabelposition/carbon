import { useEffect, useRef } from "react";
import { useT } from "../i18n/i18n";
import { FittedImage } from "../image/FittedImage";
import type { ShownImage } from "./live-preview-image";
import { Tooltip } from "../ui/Tooltip";

/**
 * An image of a note on its own, over the whole window, fit into it.
 * Escape, the close button or a click beside the image closes it.
 */
export function ImageViewer({
  image,
  onClose,
}: {
  image: ShownImage;
  onClose: () => void;
}) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);

  // A modal `<dialog>` keeps the focus inside and closes on Escape.
  useEffect(() => {
    const element = dialog.current;
    if (element === null || element.open) return;
    element.showModal();
    return () => element.close();
  }, []);

  const name = image.target.slice(image.target.lastIndexOf("/") + 1);

  return (
    <dialog
      ref={dialog}
      aria-label={image.alt || name}
      data-full-window
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-backdrop/90 text-ui text-fg backdrop:bg-transparent"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <FittedImage url={image.url} alt={image.alt} onClickBeside={onClose} />
      <p className="pointer-events-none absolute inset-x-0 bottom-0 truncate px-16 py-4 text-center text-small text-muted">
        {image.alt || name}
      </p>
      <Tooltip label={t("common.close")} shortcut="Esc">
        <button
          type="button"
          aria-label={t("common.close")}
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-md text-muted outline-none hover:bg-raise hover:text-fg focus-visible:ring-1 focus-visible:ring-line-strong"
          onClick={onClose}
        >
          <svg
            viewBox="0 0 10 10"
            width="10"
            height="10"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
          </svg>
        </button>
      </Tooltip>
    </dialog>
  );
}
