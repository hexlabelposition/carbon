import { appCacheDir } from "@tauri-apps/api/path";

/** The core uses `/` on every platform; Windows reports `\`. */
export function toCorePath(path: string): string {
  return path.replaceAll("\\", "/");
}

/**
 * The app cache folder, in core form: for what can be made again, such as
 * the index, or the sandbox.
 */
export async function appCacheFolder(): Promise<string> {
  return toCorePath(await appCacheDir());
}
