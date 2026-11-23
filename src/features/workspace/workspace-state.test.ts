import { describe, expect, test } from "bun:test";
import {
  initialWorkspace,
  noteOf,
  workspaceReducer,
  type WorkspaceAction,
  type WorkspaceState,
} from "./workspace-state";

const run = (state: WorkspaceState, ...actions: WorkspaceAction[]) =>
  actions.reduce(workspaceReducer, state);
const open = (
  path: string,
  target: "here" | "newTab" | "beside" = "here",
): WorkspaceAction => ({ type: "open", path, target });
/** The notes of the tabs of each pane. */
const notes = (state: WorkspaceState) =>
  state.panes.map((pane) => pane.tabs.map(noteOf));

describe("tabs of the same note", () => {
  test("a new tab of a note open in the pane is made all the same", () => {
    const state = run(initialWorkspace("a.md"), open("a.md", "newTab"));
    expect(notes(state)).toEqual([["a.md", "a.md"]]);
    expect(state.panes[0].activeId).toBe(state.panes[0].tabs[1].id);
  });

  test("opening a note here goes to its tab", () => {
    const start = run(initialWorkspace("a.md"), open("b.md", "newTab"));
    const state = run(start, open("a.md"));
    expect(notes(state)).toEqual([["a.md", "b.md"]]);
    expect(state.panes[0].activeId).toBe(state.panes[0].tabs[0].id);
  });

  test("a note open in the other pane is not opened in a second one", () => {
    const start = run(initialWorkspace("a.md"), open("b.md", "beside"), {
      type: "focusPane",
      index: 1,
    });
    const state = run(start, open("a.md", "newTab"));
    expect(notes(state)).toEqual([["a.md"], ["b.md"]]);
    expect(state.activePane).toBe(0);
  });

  test("a rename keeps the tabs of a note in one pane", () => {
    const start = run(initialWorkspace("a.md"), open("a.md", "newTab"));
    const state = run(start, { type: "moved", from: "a.md", to: "c.md" });
    expect(notes(state)).toEqual([["c.md", "c.md"]]);
  });

  test("a deletion elsewhere keeps the tabs of a note", () => {
    const start = run(
      initialWorkspace("a.md"),
      open("a.md", "newTab"),
      open("b.md", "newTab"),
    );
    const state = run(start, { type: "removed", path: "b.md" });
    expect(notes(state)).toEqual([["a.md", "a.md"]]);
  });

  test("a rename that brings a note into both panes leaves it in one", () => {
    const start = run(initialWorkspace("a.md"), open("b.md", "beside"));
    const state = run(start, { type: "moved", from: "b.md", to: "a.md" });
    // The pane of the tab looked at, the second, keeps it.
    expect(notes(state)).toEqual([["a.md"]]);
  });
});
