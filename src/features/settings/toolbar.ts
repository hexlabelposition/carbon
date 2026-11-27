import type { MessageKey } from "../i18n/i18n";
import { preference } from "./preference";

/**
 * Whether the toolbar at the left edge of the window is shown: switched
 * in the settings, from the palette and by its shortcut, all one setting.
 * Stored as it was while the shell kept it (`useSidePanel`).
 */
export const toolbarPreference = preference<boolean>(
  "carbon.desktop.toolbar",
  true,
  (stored) =>
    stored === "true" ? true : stored === "false" ? false : undefined,
);

/** Shows the toolbar if it is hidden, hides it if it is shown. */
export function toggleToolbar(): void {
  toolbarPreference.set(!toolbarPreference.get());
}

/**
 * The buttons at the top of the toolbar, which can be hidden one by one,
 * in their order: the ids of the buttons, those of their commands for
 * the ones that run a command (as `OPEN_SEARCH`).
 */
export const TOOLBAR_TOOLS: readonly { id: string; label: MessageKey }[] = [
  { id: "sidebar.explorer", label: "shell.files" },
  { id: "sidebar.bookmarks", label: "shell.bookmarks" },
  { id: "sidebar.tags", label: "shell.tags" },
  { id: "sidebar.drafts", label: "shell.drafts" },
  { id: "sidebar.trash", label: "shell.trash" },
  { id: "switcher.open", label: "switcher.open" },
  { id: "randomNote.open", label: "randomNote.open" },
  { id: "graph.toggle", label: "graph.toggle" },
  { id: "palette.open", label: "palette.open" },
];

/**
 * The tools hidden from the toolbar, by id: hidden from its menu of the
 * right button or in the settings. What they do stays in the palette
 * and on their keys. The buttons at its foot are always there.
 */
export const hiddenToolsPreference = preference<readonly string[]>(
  "carbon.desktop.hiddenTools",
  [],
  (stored) => {
    try {
      const value: unknown = JSON.parse(stored);
      return Array.isArray(value) && value.every((id) => typeof id === "string")
        ? (value as string[])
        : undefined;
    } catch {
      return undefined;
    }
  },
  (value) => JSON.stringify(value),
);

/** Shows the tool `id` on the toolbar, or hides it. */
export function setToolShown(id: string, shown: boolean): void {
  const hidden = hiddenToolsPreference.get().filter((other) => other !== id);
  hiddenToolsPreference.set(shown ? hidden : [...hidden, id]);
}

/**
 * The order of the buttons at the top of the toolbar, by id, as they were
 * dragged; empty for the order of `TOOLBAR_TOOLS`.
 */
export const toolOrderPreference = preference<readonly string[]>(
  "carbon.desktop.toolOrder",
  [],
  (stored) => {
    try {
      const value: unknown = JSON.parse(stored);
      return Array.isArray(value) && value.every((id) => typeof id === "string")
        ? (value as string[])
        : undefined;
    } catch {
      return undefined;
    }
  },
  (value) => JSON.stringify(value),
);

/**
 * The ids of `tools`, in their order, put in the order `stored`. An id
 * stored that is not among them is dropped. A tool not stored, as one
 * that came with an update, keeps its place after the tool it follows in
 * `tools`, or goes first if it is the first.
 */
export function orderTools(
  tools: readonly string[],
  stored: readonly string[],
): string[] {
  const known = new Set(tools);
  const order = stored.filter(
    (id, index) => known.has(id) && stored.indexOf(id) === index,
  );
  const placed = new Set(order);
  tools.forEach((id, index) => {
    if (placed.has(id)) return;
    const before = index === 0 ? -1 : order.indexOf(tools[index - 1]!);
    order.splice(before + 1, 0, id);
    placed.add(id);
  });
  return order;
}

/**
 * `order` with `id` moved to `to` among the tools that are shown, those
 * not in `hidden`: before the shown tool that is there now, or after the
 * last one. The hidden tools keep their places among the others.
 */
export function moveTool(
  order: readonly string[],
  hidden: ReadonlySet<string>,
  id: string,
  to: number,
): string[] {
  const rest = order.filter((other) => other !== id);
  const shown = rest.filter((other) => !hidden.has(other));
  const target = shown[Math.max(0, to)];
  const at =
    target === undefined
      ? shown.length === 0
        ? rest.length
        : rest.indexOf(shown[shown.length - 1]!) + 1
      : rest.indexOf(target);
  rest.splice(at, 0, id);
  return rest;
}

/** The ids of the tools at the top of the toolbar, in the order kept. */
export function useToolOrder(): string[] {
  const stored = toolOrderPreference.use();
  return orderTools(
    TOOLBAR_TOOLS.map((tool) => tool.id),
    stored,
  );
}

/** Moves the shown tool `id` to `to` among the shown ones, and keeps it. */
export function setToolPlace(id: string, to: number): void {
  const hidden = new Set(hiddenToolsPreference.get());
  const order = orderTools(
    TOOLBAR_TOOLS.map((tool) => tool.id),
    toolOrderPreference.get(),
  );
  toolOrderPreference.set(moveTool(order, hidden, id, to));
}
