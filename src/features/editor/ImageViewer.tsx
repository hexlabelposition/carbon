import { useEffect, useRef, useState } from "react";
import type { ShownImage } from "./live-preview-image";

/**
 * An image of a note on its own, over the whole window. At first it fits
 * the window; a click on it shows it at its own size, to scroll around,
 * and back. Escape, the close button or a click beside the image closes
 * it.
 */
export function ImageViewer({
  image,
  onClose,
}: {
  image: ShownImage;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  /** Shown at its own size, not fit into the window. */
  const [actual, setActual] = useState(false);
  /** Bigger than the window: only then does a click change the size. */
  const [large, setLarge] = useState(false);

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
      // A click beside the image lands on the dialog or its frame.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`flex h-full w-full overflow-auto p-12 ${
          actual ? "" : "items-center justify-center"
        }`}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <img
          src={image.url}
          alt={image.alt}
          draggable={false}
          className={`m-auto rounded-md ${
            actual
              ? "max-w-none cursor-zoom-out"
              : `max-h-full max-w-full object-contain ${large ? "cursor-zoom-in" : ""}`
          }`}
          onLoad={(event) => {
            const img = event.currentTarget;
            setLarge(
              img.naturalWidth > img.clientWidth ||
                img.naturalHeight > img.clientHeight,
            );
          }}
          onClick={() => {
            if (large) setActual((value) => !value);
          }}
        />
      </div>
      <p
        className="pointer-events-none absolute inset-x-0 bottom-0 truncate px-16 py-4 text-center text-small text-muted"
        title={image.target}
      >
        {image.alt || name}
      </p>
      <button
        type="button"
        aria-label="Close"
        title="Close (Escape)"
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
    </dialog>
  );
}
