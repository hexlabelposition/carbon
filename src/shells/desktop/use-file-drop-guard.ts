import { useEffect } from "react";

/**
 * A file dropped on the window where nothing takes it would be opened by
 * the WebView in place of the app, with no way back. This turns such drops
 * into nothing. Places that do take drops, like the editor, are left alone.
 */
export function useFileDropGuard(): void {
  useEffect(() => {
    // A file comes as "Files", or, on Linux, as a list of addresses. A
    // dragged web link is such a list too, and would be opened the same way.
    const opensInWebView = (event: DragEvent) =>
      event.dataTransfer !== null &&
      (event.dataTransfer.types.includes("Files") ||
        event.dataTransfer.types.includes("text/uri-list"));

    /** Text fields and the editor take drops, text among them. */
    const overEditable = (event: DragEvent) =>
      event.target instanceof Element &&
      event.target.closest("input, textarea, [contenteditable]") !== null;

    function onDragOver(event: DragEvent) {
      if (!opensInWebView(event) || overEditable(event)) return;
      event.preventDefault();
      // Shows the "not allowed" cursor: nothing here takes the file.
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
    }

    function onDrop(event: DragEvent) {
      if (opensInWebView(event) && !overEditable(event)) event.preventDefault();
    }

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
}
