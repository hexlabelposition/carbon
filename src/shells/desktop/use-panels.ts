import { useCallback, useEffect, useState } from "react";
import { matchesShortcut } from "../../features/shortcuts/shortcuts";
import { usePanelWidth, type PanelWidth } from "./use-sidebar";

/** What the right panel shows. */
export type RightPanelView = "outline" | "backlinks" | "graph";

export interface RightPanel {
  open: boolean;
  /** How wide it is, as the sidebar: a share of the window. */
  width: PanelWidth;
  toggle(): void;
  view: RightPanelView;
  /** Shows `view` in the panel, opening it if it is shut. */
  show(view: RightPanelView): void;
  /** Shows `view`, or shuts the panel if it shows `view` already. */
  toggleView(view: RightPanelView): void;
}

const VIEW_KEY = "carbon.desktop.rightPanel.view";

/**
 * The panel at the right of the note, which shows its outline, the notes
 * that link to it or the graph around it, one at a time, as the left panel shows files or search.
 * It is shut at every app start, opening it is up to the user; what it
 * shows and how wide it is are remembered between starts.
 */
export function useRightPanel(): RightPanel {
  // Before, the outline and the backlinks were two parts switched on
  // apart: the view starts from the one that was on.
  const [before] = useState(() => ({
    outline: loadFlag("carbon.desktop.outline"),
    backlinks: loadFlag("carbon.desktop.backlinks"),
  }));
  const [open, set] = useState(false);
  const toggle = useCallback(() => set((value) => !value), []);
  // About 16rem, the width it had before it could be resized, on a
  // window 1280 pixels wide.
  const width = usePanelWidth("carbon.desktop.rightPanel.width", 0.2);
  const [view, setView] = useState<RightPanelView>(() =>
    loadView(before.backlinks && !before.outline ? "backlinks" : "outline"),
  );

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Without storage the panel works, it only forgets what it showed.
    }
  }, [view]);

  const show = useCallback(
    (next: RightPanelView) => {
      setView(next);
      set(true);
    },
    [set],
  );
  const toggleView = useCallback(
    (next: RightPanelView) => {
      if (open && view === next) set(false);
      else show(next);
    },
    [open, view, set, show],
  );

  return { open, width, toggle, view, show, toggleView };
}

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function loadView(fallback: RightPanelView): RightPanelView {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === "outline" || saved === "backlinks" || saved === "graph"
      ? saved
      : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The shortcuts that show or hide the panels: by default Ctrl+B the left
 * one, Ctrl+Alt+B the right one, Ctrl+` the toolbar, Cmd in place of Ctrl
 * on a Mac. Only while `enabled`: the panels belong to an open vault.
 */
export function usePanelShortcuts(
  enabled: boolean,
  toggleLeft: () => void,
  toggleRight: () => void,
  toggleToolbar: () => void,
): void {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (matchesShortcut(event, "shell.toolbar")) toggleToolbar();
      else if (matchesShortcut(event, "shell.sidebar")) toggleLeft();
      else if (matchesShortcut(event, "shell.rightPanel")) toggleRight();
      else return;
      event.preventDefault();
      event.stopPropagation();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, toggleLeft, toggleRight, toggleToolbar]);
}
