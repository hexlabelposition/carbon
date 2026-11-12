import { attachmentLink, type NotePath, type Vault } from "@carbon/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageHost } from "./live-preview-image";

/** Image files the editor shows, by the ending of their name. */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

export interface NoteImages {
  host: ImageHost;
  /** Why the last pasted or dropped file was not taken, for the user. */
  error: string | null;
  dismissError(): void;
}

/**
 * The images of one note: reads the ones it shows from the vault, and
 * saves the ones pasted or dropped into it as attachments.
 */
export function useNoteImages(vault: Vault, path: NotePath): NoteImages {
  const [error, setError] = useState<string | null>(null);

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
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setError(`The image could not be saved: ${message}`);
        throw reason;
      }
    }

    return {
      async load(target) {
        const file = await vault.attachments.find(path, target);
        if (file === null) return null;
        const type = IMAGE_TYPES[endingOf(file)];
        if (type === undefined) return null;
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
    };
  }, [vault, path]);

  return { host, error, dismissError: () => setError(null) };
}

function endingOf(name: string): string {
  return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
}

/**
 * The file name for a pasted or dropped image. An image copied from a
 * program has no name of its own, only "image.png": it is named by the
 * time instead, so that pasted images sort in the order they were added.
 */
function nameFor(image: File): string {
  if (image.name !== "" && !/^image\.\w+$/i.test(image.name)) return image.name;
  const ending =
    Object.entries(IMAGE_TYPES).find(([, type]) => type === image.type)?.[0] ??
    "png";
  const two = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const date = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`;
  const time = `${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
  return `pasted-${date}-${time}.${ending}`;
}
