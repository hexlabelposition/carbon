import { getCurrentWebview } from "@tauri-apps/api/webview";

/**
 * Scales the whole interface, as a browser zooms a page: `1` is 100%.
 * The WebView zooms, not CSS, so the editor keeps placing the cursor
 * where the pointer is.
 */
export function setInterfaceZoom(scale: number): Promise<void> {
  return getCurrentWebview().setZoom(scale);
}
