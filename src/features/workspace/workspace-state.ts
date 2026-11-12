import type { NotePath } from "@carbon/core";
import { isWithin, rebase } from "../vault/paths";

/**
 * One tab: the notes it has shown, oldest first, and which of them it shows
 * now. Going back and forward moves `index`; opening a note from the middle
 * of the history drops what was ahead, like a browser tab.
 */
export interface Tab {
  id: number;
  history: readonly NotePath[];
  index: number;
}

export interface WorkspaceState {
  tabs: readonly Tab[];
  /** The tab that is shown; `null` only when there are no tabs. */
  activeId: number | null;
  /** The id the next new tab gets. */
  nextId: number;
}

export type WorkspaceAction =
  | { type: "open"; path: NotePath; newTab: boolean }
  | { type: "activate"; id: number }
  | { type: "close"; id: number }
  | { type: "back" }
  | { type: "forward" }
  /** A note or folder was renamed or moved. */
  | { type: "moved"; from: string; to: string }
  /** A note or folder was deleted. */
  | { type: "removed"; path: string };

/** A tab does not remember more notes than this. */
const MAX_HISTORY = 50;

export function initialWorkspace(note: NotePath | null): WorkspaceState {
  return note === null
    ? { tabs: [], activeId: null, nextId: 1 }
    : { tabs: [{ id: 1, history: [note], index: 0 }], activeId: 1, nextId: 2 };
}

/** The note a tab shows. */
export function noteOf(tab: Tab): NotePath {
  return tab.history[tab.index];
}

export function activeTab(state: WorkspaceState): Tab | undefined {
  return state.tabs.find((tab) => tab.id === state.activeId);
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case "open": {
      // A note is shown by one tab at most: two editors of the same note
      // would save over each other.
      const shown = state.tabs.find((tab) => noteOf(tab) === action.path);
      if (shown) return { ...state, activeId: shown.id };
      const active = activeTab(state);
      if (action.newTab || active === undefined) {
        const tab = { id: state.nextId, history: [action.path], index: 0 };
        const at = active ? state.tabs.indexOf(active) + 1 : state.tabs.length;
        return {
          tabs: [...state.tabs.slice(0, at), tab, ...state.tabs.slice(at)],
          activeId: tab.id,
          nextId: state.nextId + 1,
        };
      }
      const history = [
        ...active.history.slice(0, active.index + 1),
        action.path,
      ].slice(-MAX_HISTORY);
      return replaceTab(state, {
        ...active,
        history,
        index: history.length - 1,
      });
    }

    case "activate":
      return state.tabs.some((tab) => tab.id === action.id)
        ? { ...state, activeId: action.id }
        : state;

    case "close":
      return withTabs(
        state,
        state.tabs.filter((tab) => tab.id !== action.id),
      );

    case "back":
    case "forward": {
      const active = activeTab(state);
      if (active === undefined) return state;
      const index = active.index + (action.type === "back" ? -1 : 1);
      if (index < 0 || index >= active.history.length) return state;
      return replaceTab(state, { ...active, index });
    }

    case "moved":
      return rewrite(state, (note) =>
        isWithin(note, action.from)
          ? rebase(note, action.from, action.to)
          : note,
      );

    case "removed":
      return rewrite(state, (note) =>
        isWithin(note, action.path) ? null : note,
      );
  }
}

function replaceTab(state: WorkspaceState, tab: Tab): WorkspaceState {
  return {
    ...state,
    tabs: state.tabs.map((other) => (other.id === tab.id ? tab : other)),
  };
}

/**
 * The state with another list of tabs. If the active tab is no longer in
 * it, the tab that took its place becomes active, else the one before.
 */
function withTabs(state: WorkspaceState, tabs: readonly Tab[]): WorkspaceState {
  if (tabs.some((tab) => tab.id === state.activeId)) return { ...state, tabs };
  const was = state.tabs.findIndex((tab) => tab.id === state.activeId);
  const before = state.tabs.slice(0, was).filter((tab) => tabs.includes(tab));
  const next = tabs[before.length] ?? tabs[before.length - 1];
  return { ...state, tabs, activeId: next?.id ?? null };
}

/**
 * Applies `change` to every note in every history; `null` drops the note.
 * A tab whose current note is dropped shows the one before it, and a tab
 * left without notes is closed.
 */
function rewrite(
  state: WorkspaceState,
  change: (note: NotePath) => NotePath | null,
): WorkspaceState {
  const tabs: Tab[] = [];
  for (const tab of state.tabs) {
    const history: NotePath[] = [];
    let index = 0;
    tab.history.forEach((note, i) => {
      const next = change(note);
      // Going back must never land on the note it started from.
      if (next !== null && history[history.length - 1] !== next) {
        history.push(next);
      }
      if (i === tab.index) index = Math.max(0, history.length - 1);
    });
    if (history.length > 0) tabs.push({ ...tab, history, index });
  }
  // Two tabs may now show the same note; only the first one keeps it.
  const seen = new Set<NotePath>();
  const unique = tabs.filter((tab) => {
    const note = noteOf(tab);
    if (seen.has(note) && tab.id !== state.activeId) return false;
    seen.add(note);
    return true;
  });
  return withTabs(state, unique);
}
