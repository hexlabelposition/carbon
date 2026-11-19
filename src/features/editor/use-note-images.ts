import { attachmentLink, type NotePath, type Vault } from "@carbon/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n/i18n";
import { imageEndingOf, imageTypeOf } from "../image/image-file";
import type { ImageHost, ShownImage } from "./live-preview-image";
import { errorText } from "../i18n/error-text";

export interface NoteImages {
  host: ImageHost;
  /** Why the last pasted or dropped file was not taken, for the user. */
  error: string | null;
  dismissError(): void;
  /** The image shown on its own, over the whole window, if one is. */
  shown: ShownImage | null;
  closeShown(): void;
}

/**
 * The images of one note: reads the ones it shows from the vault, and
 * saves the ones pasted or dropped into it as attachments.
 */
export function useNoteImages(vault: Vault, path: NotePath): NoteImages {
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<ShownImage | null>(null);

  // Image bytes are handed to the browser as object URLs, one per file,
  // kept for as long as the note is open.
  const urls = useRef(new Map<string, Promise<string | null>>());
  useEffect(() => {
    const cache = urls.current;
    return () => {
      for (const url of cache.values()) {
        void url.then((value) => value !== null && URL.revokeObjectURL(value));
      }
      cache.clear();
    };
  }, [vault, path]);

  const host = useMemo<ImageHost>(() => {
    /** Runs a save; resolves with the address to write in the note. */
    async function saved(save: () => Promise<string>): Promise<string> {
      try {
        const link = attachmentLink(path, await save());
        setError(null);
        return link;
      } catch (reason) {
        const message = errorText(reason);
        setError(t("images.saveFailed", { reason: message }));
        throw reason;
      }
    }

    return {
      async load(target) {
        const file = await vault.attachments.find(path, target);
        if (file === null) return null;
        const type = imageTypeOf(file);
        if (type === null) return null;
        let url = urls.current.get(file);
        if (url === undefined) {
          url = vault.attachments.read(file).then(
            (bytes) => URL.createObjectURL(new Blob([bytes.slice()], { type })),
            () => null,
          );
          urls.current.set(file, url);
        }
        return url;
      },

      save: (image) =>
        saved(async () => {
          const bytes = new Uint8Array(await image.arrayBuffer());
          return vault.attachments.save(nameFor(image), bytes);
        }),

      importFile: (source) => saved(() => vault.attachments.import(source)),

      refuse: setError,

      open: setShown,
    };
  }, [vault, path]);

  return {
    host,
    error,
    dismissError: () => setError(null),
    shown,
    closeShown: () => setShown(null),
  };
}

/**
 * The file name for a pasted or dropped image. An image copied from a
 * program has no name of its own, only "image.png": it is named by the
 * time instead, so that pasted images sort in the order they were added.
 */
function nameFor(image: File): string {
  if (image.name !== "" && !/^image\.\w+$/i.test(image.name)) return image.name;
  const ending = imageEndingOf(image.type) ?? "png";
  const two = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const date = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`;
  const time = `${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
  return `pasted-${date}-${time}.${ending}`;
}
