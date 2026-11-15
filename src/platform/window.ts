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
};
