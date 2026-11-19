import type { Vault } from "@carbon/core";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "../i18n/i18n";
import { imageTypeOf } from "./image-file";
import { FittedImage } from "./FittedImage";
import { Tooltip } from "../ui/Tooltip";
import { errorText } from "../i18n/error-text";

type Loaded =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

/**
 * An image file of the vault, shown in a tab where a note would be: opened
 * from the file tree. Give it a `key` of its path: it loads the image once.
 */
export function ImageView({
  vault,
  path,
  history,
}: {
  vault: Vault;
  path: string;
  /** Back and forward, at the start of the bar above the image. */
  history?: ReactNode;
}) {
  const t = useT();
  const [image, setImage] = useState<Loaded>({ status: "loading" });

  useEffect(() => {
    let current = true;
    let url: string | null = null;
    const type = imageTypeOf(path) ?? "application/octet-stream";
    vault.attachments.read(path).then(
      (bytes) => {
        if (!current) return;
        url = URL.createObjectURL(new Blob([bytes.slice()], { type }));
        setImage({ status: "ready", url });
      },
      (reason: unknown) => {
        if (!current) return;
        const message = errorText(reason);
        setImage({ status: "error", message });
      },
    );
    return () => {
      current = false;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [vault, path]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-1.5">
        {history}
        <Tooltip label={path}>
          <span className="min-w-0 flex-1 truncate px-2 text-muted">
            {path}
          </span>
        </Tooltip>
      </header>
      <div className="min-h-0 flex-1">
        {image.status === "ready" && <FittedImage url={image.url} alt={path} />}
        {image.status === "error" && (
          <p
            role="alert"
            className="flex h-full items-center justify-center px-8 text-center text-danger"
          >
            {t("start.couldNotOpen", { root: path, reason: image.message })}
          </p>
        )}
      </div>
    </div>
  );
}
