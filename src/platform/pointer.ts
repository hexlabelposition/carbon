import { listen } from "@tauri-apps/api/event";
import { POINTER_LEFT_WINDOW } from "../features/ui/pointer-outside";

/**
 * Passes on to the page the window telling that the pointer left it
 * (`tauri/src/lib.rs`), as the DOM event `POINTER_LEFT_WINDOW`: WebKitGTK
 * does not tell it on Wayland. Once, at start.
 */
export function forwardPointerLeaves(): void {
  void listen("pointer-left-window", () =>
    window.dispatchEvent(new Event(POINTER_LEFT_WINDOW)),
  ).catch(() => {
    // Outside the app, as in a browser: the DOM events are all there is.
  });
}
