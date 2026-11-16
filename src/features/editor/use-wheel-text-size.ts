import { useCallback } from "react";
import {
  NOTE_SIZES,
  noteSizePreference,
  resetNoteSize,
  wheelTextSizePreference,
} from "../settings/note-style";

/**
 * How far a touchpad must go, in pixels, for one size step: a pinch on
 * one comes as Ctrl with many small wheel steps. A notch of a mouse wheel
 * goes past it at once.
 */
const STEP = 50;

/** How long after the press its paste may come, in milliseconds. */
const PASTE_WINDOW = 1000;

/**
 * Ctrl and the mouse wheel over a note (Cmd on a Mac) make its text
 * larger or smaller, a size of the settings at a time; the rest of the
 * interface stays as it is. Ctrl and a press of the wheel put it back to
 * the default size. Off in the settings, it does nothing.
 *
 * Returns a ref for the element of the note.
 */
export function useWheelTextSize(): (element: HTMLElement | null) => void {
  return useCallback((element: HTMLElement | null) => {
    if (element === null) return;
    /** The way gone since the last step, up negative. */
    let gone = 0;

    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (!wheelTextSizePreference.get()) return;
      // Not the zoom of the WebView, nor a scroll of the note.
      event.preventDefault();
      gone +=
        event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
          ? event.deltaY
          : Math.sign(event.deltaY) * STEP;
      if (Math.abs(gone) < STEP) return;
      // The wheel away from the user, up, makes the text larger.
      const step = gone < 0 ? 1 : -1;
      gone = 0;
      const at = NOTE_SIZES.indexOf(noteSizePreference.get());
      const next = Math.min(Math.max(at + step, 0), NOTE_SIZES.length - 1);
      noteSizePreference.set(NOTE_SIZES[next]);
    };

    /**
     * Until when a paste is the one of the press that reset the size:
     * on Linux the middle button pastes the selection, and WebKitGTK does
     * it on the release, past what the press itself can stop.
     */
    let swallowPasteUntil = 0;

    /** The middle button with Ctrl: this hook's, and nothing else's. */
    const isReset = (event: MouseEvent) =>
      event.button === 1 &&
      (event.ctrlKey || event.metaKey) &&
      wheelTextSizePreference.get();

    const onMouseDown = (event: MouseEvent) => {
      if (!isReset(event)) return;
      event.preventDefault();
      event.stopPropagation();
      swallowPasteUntil = performance.now() + PASTE_WINDOW;
      gone = 0;
      resetNoteSize();
    };
    // The release and the click of that press go nowhere either.
    const onRelease = (event: MouseEvent) => {
      if (!isReset(event)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onPaste = (event: ClipboardEvent) => {
      if (performance.now() > swallowPasteUntil) return;
      swallowPasteUntil = 0;
      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    // Capture: before the editor sees the press, its release or the paste.
    element.addEventListener("mousedown", onMouseDown, true);
    element.addEventListener("mouseup", onRelease, true);
    element.addEventListener("auxclick", onRelease, true);
    element.addEventListener("paste", onPaste, true);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("mousedown", onMouseDown, true);
      element.removeEventListener("mouseup", onRelease, true);
      element.removeEventListener("auxclick", onRelease, true);
      element.removeEventListener("paste", onPaste, true);
    };
  }, []);
}
