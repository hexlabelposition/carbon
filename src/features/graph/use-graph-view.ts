import { useCallback, useMemo, useState } from "react";
import { useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";

/** The command that shows or hides the graph, offered in the toolbar. */
export const TOGGLE_GRAPH = "graph.toggle";

export interface GraphViewState {
  /** The note area shows the graph in place of the notes. */
  open: boolean;
  toggle(): void;
  close(): void;
}

/** Whether the graph is shown, and the command that shows or hides it. */
export function useGraphView(): GraphViewState {
  const t = useT();
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((shown) => !shown), []);
  const close = useCallback(() => setOpen(false), []);
  useCommands(
    useMemo(
      () => [{ id: TOGGLE_GRAPH, title: t("graph.toggle"), run: toggle }],
      [t, toggle],
    ),
  );
  return { open, toggle, close };
}
