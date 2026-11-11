import type { NotePath } from "@carbon/core";
import { createContext, useContext } from "react";

/** The note the workspace shows, and how the features change it. */
export interface ActiveNote {
  /** The open note, or `null` when none is. */
  path: NotePath | null;
  open(path: NotePath): void;
  close(): void;
  /** Tells that a note or folder was moved, so the open note is followed. */
  moved(from: string, to: string): void;
  /** Tells that a note or folder was deleted. */
  removed(path: string): void;
}

export const ActiveNoteContext = createContext<ActiveNote | null>(null);

/** The open note of the workspace. Needs an `ActiveNoteProvider` above. */
export function useActiveNote(): ActiveNote {
  const active = useContext(ActiveNoteContext);
  if (active === null) {
    throw new Error("useActiveNote needs an ActiveNoteProvider above it");
  }
  return active;
}
