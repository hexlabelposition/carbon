import { useCallback, useEffect, useState } from "react";
import { panelCloseFraction } from "./layout";

/**
 * The sidebar width is a share of the window width, not pixels, so the
 * layout keeps its proportions on any screen (ARCHITECTURE.md, section 8).
 * It has no narrowest width: a panel dragged near its edge closes instead
 * (`ResizeHandle`), so a width below `panelCloseFraction` is never kept.
 * Nor a widest: it stops short of the other panel (`noteMinFraction`).
 */
const SIDEBAR_DEFAULT = 0.22;
/** One arrow-key press on the resize handle. */
export const SIDEBAR_STEP = 0.02;

const STORAGE_KEY = "carbon.desktop.sidebar";

interface SidebarState {
  /** Width as a share of the window width. */
  fraction: number;
  collapsed: boolean;
}

export interface Sidebar extends SidebarState {
  /** Sets the width, as a share of the window width. */
  resize(fraction: number): void;
  /** Makes the sidebar wider (positive) or narrower by whole steps. */
  nudge(steps: number): void;
  toggle(): void;
  close(): void;
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
  const close = useCallback(() => {
    setState((s) => ({ ...s, collapsed: true }));
  }, []);

  return { ...state, resize, nudge, toggle, close };
}

function clamp(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

/**
 * A width saved before, if it can be used: one narrower than a panel is
 * kept open at, such as the width a panel was closed at, is not.
 */
function savedWidth(fraction: number, fallback: number): number {
  return fraction >= panelCloseFraction() ? clamp(fraction) : fallback;
}

function load(): SidebarState {
  const state: SidebarState = { fraction: SIDEBAR_DEFAULT, collapsed: false };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    if (typeof saved !== "object" || saved === null) return state;
    const { fraction, collapsed } = saved as Record<string, unknown>;
    if (typeof fraction === "number" && Number.isFinite(fraction)) {
      state.fraction = savedWidth(fraction, SIDEBAR_DEFAULT);
    }
    if (typeof collapsed === "boolean") state.collapsed = collapsed;
  } catch {
    // Nothing saved yet, or not what this version wrote: use the defaults.
  }
  return state;
}

export interface PanelWidth {
  /** Width as a share of the window width. */
  fraction: number;
  /** Sets the width, as a share of the window width. */
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
      return Number.isFinite(saved) ? savedWidth(saved, fallback) : fallback;
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
