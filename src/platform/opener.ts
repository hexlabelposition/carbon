import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

/**
 * Opens the file manager of the system at the absolute path `path`, with
 * that file or folder selected in its folder.
 */
export function showInFileManager(path: string): Promise<void> {
  return revealItemInDir(path);
}

/** Opens a web page, `https://` or `http://`, in the default browser. */
export function openWebPage(url: string): Promise<void> {
  return openUrl(url);
}
