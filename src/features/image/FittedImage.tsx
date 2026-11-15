/**
 * An image that fits the box it is in, centered, never bigger than it is.
 * A click beside the image calls `onClickBeside`.
 */
export function FittedImage({
  url,
  alt,
  onClickBeside,
}: {
  url: string;
  alt: string;
  onClickBeside?: () => void;
}) {
  return (
    <div
      className="flex h-full w-full items-center justify-center p-12"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClickBeside?.();
      }}
    >
      <img
        src={url}
        alt={alt}
        draggable={false}
        className="max-h-full max-w-full rounded-md object-contain"
      />
    </div>
  );
}
