import { useT } from "../i18n/i18n";
import { FittedImage } from "../image/FittedImage";
import type { ShownImage } from "./live-preview-image";
import { Tooltip } from "../ui/Tooltip";
import { AppDialog } from "../dialogs/AppDialog";
import { imageName } from "./web-images";

/**
 * An image of a note on its own, over the window below its top row, fit
 * into it.
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
  const name = imageName(image.target);

  return (
    // Below the top row, as every dialog: the window buttons stay in reach.
    <AppDialog
      aria-label={image.alt || name}
      onClose={onClose}
      backdrop="bg-transparent"
      className="fixed inset-x-0 top-bar bottom-0 bg-backdrop/90"
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
            width="12"
            height="12"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
          </svg>
        </button>
      </Tooltip>
    </AppDialog>
  );
}
