import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * The app window, for the title bar the app draws itself: the system frame
 * is off (`decorations: false` in `tauri.conf.json`). Dragging the window
 * by its title bar is done by Tauri for elements marked with
 * `data-tauri-drag-region`.
 */
export const tauriWindow = {
  minimize: () => getCurrentWindow().minimize(),
  toggleMaximize: () => getCurrentWindow().toggleMaximize(),
  close: () => getCurrentWindow().close(),
  isMaximized: () => getCurrentWindow().isMaximized(),
  /** Calls `listener` after every resize; resolves to a function that stops it. */
  onResized: (listener: () => void) =>
    getCurrentWindow().onResized(() => listener()),
  /**
   * Paints the window and the WebView behind the page in `color`, a CSS
   * hex color: what shows in a part of the window the page has not been
   * drawn into yet, such as while the window is being resized.
   */
  setBackground: async (color: string) => {
    await Promise.all([
      getCurrentWindow().setBackgroundColor(color),
      getCurrentWebview().setBackgroundColor(color),
    ]);
  },
};
