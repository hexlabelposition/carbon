import { useEffect } from "react";
import { useWorkspace } from "./workspace";
import { shortcutLetter } from "./shortcut-letter";

/**
 * Keys and mouse buttons that work anywhere in the workspace:
 *
 * - Alt+Left / Alt+Right, and the back / forward mouse buttons: history
 * - Ctrl+W: close the tab
 * - Ctrl+Tab / Ctrl+Shift+Tab: the next / previous tab
 *
 * On a Mac, Cmd takes the place of Ctrl for closing a tab.
 */
export function useWorkspaceShortcuts(): void {
  const { tabs, activeTabId, activateTab, closeTab, back, forward } =
    useWorkspace();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.altKey && !command && key === "arrowleft") back();
      else if (event.altKey && !command && key === "arrowright") forward();
      else if (command && !event.altKey && shortcutLetter(event) === "w") {
        if (activeTabId !== null) closeTab(activeTabId);
      } else if (event.ctrlKey && key === "tab") {
        const at = tabs.findIndex((tab) => tab.id === activeTabId);
        if (at === -1) return;
        const step = event.shiftKey ? tabs.length - 1 : 1;
        activateTab(tabs[(at + step) % tabs.length].id);
      } else return;
      // The editor has uses of its own for some of these keys.
      event.preventDefault();
      event.stopPropagation();
    }

    function onMouseUp(event: MouseEvent) {
      if (event.button === 3) back();
      else if (event.button === 4) forward();
      else return;
      event.preventDefault();
    }

    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [tabs, activeTabId, activateTab, closeTab, back, forward]);
}
