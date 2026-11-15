import type { Vault } from "@carbon/core";
import { useEffect, useState } from "react";
import { imageTypeOf } from "./image-file";
import { FittedImage } from "./FittedImage";

type Loaded =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

/**
 * An image file of the vault, shown in a tab where a note would be: opened
 * from the file tree. Give it a `key` of its path: it loads the image once.
 */
export function ImageView({ vault, path }: { vault: Vault; path: string }) {
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
        const message =
          reason instanceof Error ? reason.message : String(reason);
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
      <header className="flex h-9 shrink-0 items-center border-b border-line px-3">
        <span className="min-w-0 flex-1 truncate text-muted" title={path}>
          {path}
        </span>
      </header>
      <div className="min-h-0 flex-1">
        {image.status === "ready" && <FittedImage url={image.url} alt={path} />}
        {image.status === "error" && (
          <p
            role="alert"
            className="flex h-full items-center justify-center px-8 text-center text-danger"
          >
            Could not open {path}: {image.message}
          </p>
        )}
      </div>
    </div>
  );
}
