import { webImagesPreference } from "../settings/note-style";

/**
 * Images from the web. Loading one tells its server that the note was
 * opened, and from where: so it is loaded only when the settings say so,
 * or once the user asked for that image. An image asked for is shown
 * until the app closes, in every note.
 */

/** The addresses of web images the user chose to see during this run. */
const allowed = new Set<string>();
const listeners = new Set<() => void>();

webImagesPreference.subscribe(changed);

/** Whether `url` is an image on the web: "http:", "https:" or "//host". */
export function isWebImage(url: string): boolean {
  return /^<?(https?:)?\/\//i.test(url);
}

/** The address to load a web image from, as written in the note. */
export function webImageAddress(url: string): string {
  const bare = url.replace(/^<|>$/g, "");
  return bare.startsWith("//") ? `https:${bare}` : bare;
}

/** Whether a web image may be loaded now. */
export function webImageAllowed(url: string): boolean {
  return webImagesPreference.get() || allowed.has(webImageAddress(url));
}

/** Shows a web image from now on, in every note. */
export function allowWebImage(url: string): void {
  const address = webImageAddress(url);
  if (allowed.has(address)) return;
  allowed.add(address);
  changed();
}

/**
 * Calls `listener` when a web image may now be loaded that could not, or
 * the other way round. Returns a function that stops it.
 */
export function onWebImagesChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed(): void {
  for (const listener of listeners) listener();
}
