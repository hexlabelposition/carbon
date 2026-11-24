import { useCallback, useEffect, useState } from "react";
import { controlsRoomFraction } from "./layout";

/**
 * The sidebar width is a share of the window width, not pixels, so the
 * layout keeps its proportions on any screen (ARCHITECTURE.md, section 8).
 * At its narrowest a side panel is as wide as the buttons in the top right
 * corner, the same on any window: `SIDEBAR_MIN` asks how much that is now.
 *
 * Temporary: tying the minimum to those buttons is a stopgap, so both
 * panels share one minimum for now. It is to be worked out another way
 * later; `panelWidth` (layout.ts) changes with it.
 */
export const SIDEBAR_MIN = controlsRoomFraction;
export const SIDEBAR_MAX = 0.5;
const SIDEBAR_DEFAULT = 0.22;
/** One arrow-key press on the resize handle. */
const SIDEBAR_STEP = 0.02;

const STORAGE_KEY = "carbon.desktop.sidebar";

interface SidebarState {
  /** Width as a share of the window width, between the two limits. */
  fraction: number;
  collapsed: boolean;
}

export interface Sidebar extends SidebarState {
  /** Sets the width; values outside the limits are pulled back in. */
  resize(fraction: number): void;
  /** Makes the sidebar wider (positive) or narrower by whole steps. */
  nudge(steps: number): void;
  toggle(): void;
}

/** The state of the desktop sidebar, remembered between app starts. */
export function useSidebar(): Sidebar {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Without storage the sidebar works, it only forgets its size.
    }
  }, [state]);

  const resize = useCallback((fraction: number) => {
    setState((s) => ({ ...s, fraction: clamp(fraction) }));
  }, []);
  const nudge = useCallback((steps: number) => {
    setState((s) => ({
      ...s,
      fraction: clamp(s.fraction + steps * SIDEBAR_STEP),
    }));
  }, []);
  const toggle = useCallback(() => {
    setState((s) => ({ ...s, collapsed: !s.collapsed }));
  }, []);

  return { ...state, resize, nudge, toggle };
}

function clamp(fraction: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN(), fraction));
}

function load(): SidebarState {
  const state: SidebarState = { fraction: SIDEBAR_DEFAULT, collapsed: false };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    if (typeof saved !== "object" || saved === null) return state;
    const { fraction, collapsed } = saved as Record<string, unknown>;
    if (typeof fraction === "number" && Number.isFinite(fraction)) {
      state.fraction = clamp(fraction);
    }
    if (typeof collapsed === "boolean") state.collapsed = collapsed;
  } catch {
    // Nothing saved yet, or not what this version wrote: use the defaults.
  }
  return state;
}

export interface PanelWidth {
  /** Width as a share of the window width, between the two limits. */
  fraction: number;
  /** Sets the width; values outside the limits are pulled back in. */
  resize(fraction: number): void;
  /** Makes the panel wider (positive) or narrower by whole steps. */
  nudge(steps: number): void;
}

/**
 * The width of a side panel other than the sidebar, with the same limits,
 * remembered between app starts under `storageKey`.
 */
export function usePanelWidth(
  storageKey: string,
  fallback: number,
): PanelWidth {
  const [fraction, setFraction] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey) ?? Number.NaN);
      return Number.isFinite(saved) ? clamp(saved) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(fraction));
    } catch {
      // Without storage the panel works, it only forgets its size.
    }
  }, [storageKey, fraction]);

  const resize = useCallback((next: number) => setFraction(clamp(next)), []);
  const nudge = useCallback(
    (steps: number) => setFraction((f) => clamp(f + steps * SIDEBAR_STEP)),
    [],
  );
  return { fraction, resize, nudge };
}
