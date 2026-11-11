import { useCallback, useEffect, useState } from "react";

/**
 * The sidebar width is a share of the window width, not pixels, so the
 * layout keeps its proportions on any screen (ARCHITECTURE.md, section 8).
 */
export const SIDEBAR_MIN = 0.12;
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
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, fraction));
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
