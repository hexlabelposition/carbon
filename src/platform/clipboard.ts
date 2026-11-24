import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

/**
 * The text of the system clipboard, read and written by the app: the
 * WebView cannot read it by itself, as "Paste" in a menu must.
 */
export const tauriClipboard = {
  /** The text on the clipboard; "" if it holds none, as an image. */
  async readText(): Promise<string> {
    try {
      return await readText();
    } catch {
      return "";
    }
  },
  writeText(text: string): Promise<void> {
    return writeText(text);
  },
};
