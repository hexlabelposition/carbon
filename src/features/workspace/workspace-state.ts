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

/** A pane: a row of tabs and the note of one of them. */
export interface Pane {
  /** Stays while the pane does, also when the pane to its left goes. */
  id: number;
  tabs: readonly Tab[];
  /** The tab that is shown; `null` only when there are no tabs. */
  activeId: number | null;
}

/**
 * The open notes: one pane, or two side by side. A note is shown by one
 * tab at most, in either pane: two editors of the same note would save
 * over each other.
 */
export interface WorkspaceState {
  /** One or two. Only the last pane left may have no tabs. */
  panes: readonly Pane[];
  /** The pane that keys, history and the rest of the app act on. */
  activePane: number;
  /** The id the next new tab or pane gets. */
  nextId: number;
}

/** Where `open` shows a note. */
export type OpenTarget =
  /** The active tab, as the next step of its history. */
  | "here"
  /** A new tab after the active one. */
  | "newTab"
  /** The other pane, made if there is only one. */
  | "beside";

export type WorkspaceAction =
  | { type: "open"; path: NotePath; target: OpenTarget }
  | { type: "activate"; id: number }
  | { type: "close"; id: number }
  | { type: "back" }
  | { type: "forward" }
  /** The user went to a pane: clicked or tabbed into it. */
  | { type: "focusPane"; index: number }
  /** A note or folder was renamed or moved. */
  | { type: "moved"; from: string; to: string }
  /** A note or folder was deleted. */
  | { type: "removed"; path: string };

/** A tab does not remember more notes than this. */
const MAX_HISTORY = 50;
/** Panes side by side, at most. */
const MAX_PANES = 2;

export function initialWorkspace(note: NotePath | null): WorkspaceState {
  const pane: Pane =
    note === null
      ? { id: 0, tabs: [], activeId: null }
      : { id: 0, tabs: [{ id: 1, history: [note], index: 0 }], activeId: 1 };
  return { panes: [pane], activePane: 0, nextId: 2 };
}

/** The note a tab shows. */
export function noteOf(tab: Tab): NotePath {
  return tab.history[tab.index];
}

/** The tab a pane shows. */
export function shownTab(pane: Pane): Tab | undefined {
  return pane.tabs.find((tab) => tab.id === pane.activeId);
}

/** The tab of the active pane. */
export function activeTab(state: WorkspaceState): Tab | undefined {
  const pane = state.panes[state.activePane];
  return pane === undefined ? undefined : shownTab(pane);
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case "open":
      return open(state, action.path, action.target);

    case "activate": {
      const index = paneOfTab(state, action.id);
      if (index === -1) return state;
      return replacePane({ ...state, activePane: index }, index, (pane) => ({
        ...pane,
        activeId: action.id,
      }));
    }

    case "close": {
      const index = paneOfTab(state, action.id);
      if (index === -1) return state;
      const pane = state.panes[index];
      return withPane(
        state,
        index,
        withTabs(
          pane,
          pane.tabs.filter((tab) => tab.id !== action.id),
        ),
      );
    }

    case "back":
    case "forward": {
      const active = activeTab(state);
      if (active === undefined) return state;
      const index = active.index + (action.type === "back" ? -1 : 1);
      if (index < 0 || index >= active.history.length) return state;
      return replaceTab(state, state.activePane, { ...active, index });
    }

    case "focusPane":
      return action.index >= 0 &&
        action.index < state.panes.length &&
        action.index !== state.activePane
        ? { ...state, activePane: action.index }
        : state;

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

function open(
  state: WorkspaceState,
  path: NotePath,
  target: OpenTarget,
): WorkspaceState {
  // Shown already, in either pane: that tab is the one to show.
  const shownIn = state.panes.findIndex((pane) =>
    pane.tabs.some((tab) => noteOf(tab) === path),
  );
  if (shownIn !== -1) {
    const tab = state.panes[shownIn].tabs.find((t) => noteOf(t) === path);
    return tab === undefined
      ? state
      : workspaceReducer(state, { type: "activate", id: tab.id });
  }

  if (target === "beside") {
    const other =
      state.panes.length < MAX_PANES
        ? state.panes.length
        : state.panes.length - 1 - state.activePane;
    const made = other === state.panes.length;
    const next: WorkspaceState = made
      ? {
          panes: [
            ...state.panes,
            { id: state.nextId, tabs: [], activeId: null },
          ],
          activePane: other,
          nextId: state.nextId + 1,
        }
      : { ...state, activePane: other };
    // In the other pane the note takes the place of its shown note, as a
    // step of that tab's history.
    return openInPane(next, path, false);
  }
  return openInPane(state, path, target === "newTab");
}

/** Opens `path` in the active pane, which does not show it yet. */
function openInPane(
  state: WorkspaceState,
  path: NotePath,
  newTab: boolean,
): WorkspaceState {
  const index = state.activePane;
  const pane = state.panes[index];
  const active = shownTab(pane);
  if (newTab || active === undefined) {
    const tab = { id: state.nextId, history: [path], index: 0 };
    const at = active ? pane.tabs.indexOf(active) + 1 : pane.tabs.length;
    return replacePane({ ...state, nextId: state.nextId + 1 }, index, () => ({
      ...pane,
      tabs: [...pane.tabs.slice(0, at), tab, ...pane.tabs.slice(at)],
      activeId: tab.id,
    }));
  }
  const history = [...active.history.slice(0, active.index + 1), path].slice(
    -MAX_HISTORY,
  );
  return replaceTab(state, index, {
    ...active,
    history,
    index: history.length - 1,
  });
}

function paneOfTab(state: WorkspaceState, id: number): number {
  return state.panes.findIndex((pane) => pane.tabs.some((t) => t.id === id));
}

function replacePane(
  state: WorkspaceState,
  index: number,
  change: (pane: Pane) => Pane,
): WorkspaceState {
  return {
    ...state,
    panes: state.panes.map((pane, i) => (i === index ? change(pane) : pane)),
  };
}

function replaceTab(
  state: WorkspaceState,
  index: number,
  tab: Tab,
): WorkspaceState {
  return replacePane(state, index, (pane) => ({
    ...pane,
    tabs: pane.tabs.map((other) => (other.id === tab.id ? tab : other)),
  }));
}

/**
 * The state with pane `index` replaced. A pane left without tabs goes
 * away, unless it is the only one; the other pane is then the active one.
 */
function withPane(
  state: WorkspaceState,
  index: number,
  pane: Pane,
): WorkspaceState {
  if (pane.tabs.length > 0 || state.panes.length === 1) {
    return replacePane(state, index, () => pane);
  }
  const panes = state.panes.filter((_, i) => i !== index);
  const activePane =
    state.activePane === index
      ? Math.min(index, panes.length - 1)
      : state.activePane - (state.activePane > index ? 1 : 0);
  return { ...state, panes, activePane };
}

/**
 * The pane with another list of tabs. If its shown tab is no longer in it,
 * the tab that took its place is shown, else the one before.
 */
function withTabs(pane: Pane, tabs: readonly Tab[]): Pane {
  if (tabs.some((tab) => tab.id === pane.activeId)) return { ...pane, tabs };
  const was = pane.tabs.findIndex((tab) => tab.id === pane.activeId);
  const before = pane.tabs.slice(0, was).filter((tab) => tabs.includes(tab));
  const next = tabs[before.length] ?? tabs[before.length - 1];
  return { ...pane, tabs, activeId: next?.id ?? null };
}

/**
 * Applies `change` to every note in every history; `null` drops the note.
 * A tab whose current note is dropped shows the one before it, and a tab
 * left without notes is closed, as is a pane left without tabs.
 */
function rewrite(
  state: WorkspaceState,
  change: (note: NotePath) => NotePath | null,
): WorkspaceState {
  const rewritten = state.panes.map((pane) => {
    const tabs: Tab[] = [];
    for (const tab of pane.tabs) {
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
    return tabs;
  });

  // Two tabs may now show the same note; the tab the user is looking at
  // keeps it, else the first one.
  const looking = activeTab(state)?.id;
  const keeper = new Map<NotePath, number>();
  for (const tabs of rewritten) {
    for (const tab of tabs) {
      const note = noteOf(tab);
      if (!keeper.has(note) || tab.id === looking) keeper.set(note, tab.id);
    }
  }

  let next = state;
  // From the last pane: a pane that goes away does not shift the others.
  for (let i = state.panes.length - 1; i >= 0; i--) {
    const tabs = rewritten[i].filter(
      (tab) => keeper.get(noteOf(tab)) === tab.id,
    );
    next = withPane(next, i, withTabs(state.panes[i], tabs));
  }
  return next;
}
