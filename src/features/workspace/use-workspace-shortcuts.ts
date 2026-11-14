import { useCallback, useEffect, useMemo } from "react";
import { keys, useCommands, type Command } from "../commands/commands";
import { useWorkspace } from "./workspace";
import { shortcutLetter } from "./shortcut-letter";

/**
 * Keys and mouse buttons that work anywhere in the workspace, and the
 * same actions as commands of the palette:
 *
 * - Alt+Left / Alt+Right, and the back / forward mouse buttons: history
 * - Ctrl+W: close the tab
 * - Ctrl+Tab / Ctrl+Shift+Tab: the next / previous tab
 *
 * On a Mac, Cmd takes the place of Ctrl for closing a tab. The palette
 * also opens the note in the other pane.
 */
export function useWorkspaceShortcuts(): void {
  const {
    path,
    tabs,
    activeTabId,
    activateTab,
    closeTab,
    back,
    forward,
    open,
  } = useWorkspace();

  const closeActiveTab = useCallback(() => {
    if (activeTabId !== null) closeTab(activeTabId);
  }, [activeTabId, closeTab]);

  /** Activates the tab `step` places on, round the ends. */
  const stepTab = useCallback(
    (step: number) => {
      const at = tabs.findIndex((tab) => tab.id === activeTabId);
      if (at === -1) return;
      activateTab(tabs[(at + step + tabs.length) % tabs.length].id);
    },
    [tabs, activeTabId, activateTab],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.altKey && !command && key === "arrowleft") back();
      else if (event.altKey && !command && key === "arrowright") forward();
      else if (command && !event.altKey && shortcutLetter(event) === "w") {
        closeActiveTab();
      } else if (event.ctrlKey && key === "tab") {
        stepTab(event.shiftKey ? -1 : 1);
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
  }, [back, forward, closeActiveTab, stepTab]);

  useCommands(
    useMemo(() => {
      const commands: Command[] = [
        {
          id: "workspace.back",
          title: "Go back",
          shortcut: "Alt+Left",
          run: back,
        },
        {
          id: "workspace.forward",
          title: "Go forward",
          shortcut: "Alt+Right",
          run: forward,
        },
      ];
      if (activeTabId === null) return commands;
      return [
        ...commands,
        {
          id: "workspace.closeTab",
          title: "Close tab",
          shortcut: keys("Mod+W"),
          run: closeActiveTab,
        },
        {
          id: "workspace.nextTab",
          title: "Next tab",
          shortcut: "Ctrl+Tab",
          run: () => stepTab(1),
        },
        {
          id: "workspace.previousTab",
          title: "Previous tab",
          shortcut: "Ctrl+Shift+Tab",
          run: () => stepTab(-1),
        },
        ...(path === null
          ? []
          : [
              {
                id: "workspace.openBeside",
                title: "Open note in the other pane",
                run: () => open(path, { target: "beside" }),
              },
            ]),
      ];
    }, [path, activeTabId, back, forward, closeActiveTab, stepTab, open]),
  );
}
