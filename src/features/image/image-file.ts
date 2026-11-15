/** Image files the app shows, by the ending of their name. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

/** The media type of an image file, by its name; `null` if it is no image. */
export function imageTypeOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return null;
  return IMAGE_TYPES[name.slice(dot + 1).toLowerCase()] ?? null;
}

/** The ending of the name for an image of a media type, such as "png". */
export function imageEndingOf(type: string): string | null {
  return (
    Object.entries(IMAGE_TYPES).find(([, known]) => known === type)?.[0] ?? null
  );
}
