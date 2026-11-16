import { useCallback, useEffect, useState } from "react";
import { keys } from "../../features/commands/commands";
import { shortcutLetter } from "../../features/workspace/shortcut-letter";
import { useSidePanel } from "./use-side-panel";
import { usePanelWidth, type PanelWidth } from "./use-sidebar";
import { controlsRoomFraction } from "./WindowControls";

/** The keys that show or hide the panels, as the user reads them. */
export const LEFT_PANEL_SHORTCUT = keys("Mod+B");
export const RIGHT_PANEL_SHORTCUT = keys("Mod+Alt+B");
export const TOOLBAR_SHORTCUT = keys("Mod+`");

/** What the right panel shows. */
export type RightPanelView = "outline" | "backlinks";

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
 * The panel at the right of the note, which shows its outline or the notes
 * that link to it, one at a time, as the left panel shows files or search.
 * Whether it is open, what it shows and how wide it is are remembered
 * between app starts.
 */
export function useRightPanel(): RightPanel {
  // Before, the outline and the backlinks were two parts switched on
  // apart, and the panel was open while one was: start from that.
  const [before] = useState(() => ({
    outline: loadFlag("carbon.desktop.outline"),
    backlinks: loadFlag("carbon.desktop.backlinks"),
  }));
  const panel = useSidePanel(
    "carbon.desktop.rightPanel",
    before.outline || before.backlinks,
  );
  // About 16rem, the width it had before it could be resized, on a
  // window 1280 pixels wide. At its narrowest its edge meets the buttons
  // in the corner above it, not a share of the window that may be wider.
  const width = usePanelWidth(
    "carbon.desktop.rightPanel.width",
    0.2,
    controlsRoomFraction,
  );
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

  const { open, set, toggle } = panel;
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
    return saved === "outline" || saved === "backlinks" ? saved : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Ctrl+B shows or hides the left panel, Ctrl+Alt+B the right one, Ctrl+`
 * the toolbar; on a Mac Cmd takes the place of Ctrl. Only while `enabled`:
 * the panels belong to an open vault.
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
      const command = event.ctrlKey || event.metaKey;
      if (!command || event.shiftKey) return;
      // The key left of 1, by its place: on a Russian layout it types "ё".
      if (event.code === "Backquote" && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        toggleToolbar();
        return;
      }
      if (shortcutLetter(event) !== "b") return;
      event.preventDefault();
      event.stopPropagation();
      if (event.altKey) toggleRight();
      else toggleLeft();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, toggleLeft, toggleRight, toggleToolbar]);
}
