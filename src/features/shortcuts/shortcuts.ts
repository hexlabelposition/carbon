import { isMac, keys } from "../commands/commands";
import type { MessageKey } from "../i18n/i18n";
import { preference } from "../settings/preference";
import { bindingOf, type Binding } from "./keymap";

/**
 * The shortcuts the settings can change, in the order they list them,
 * with the keys they have until the user picks others.
 */
export const SHORTCUTS = [
  { id: "palette.open", label: "palette.open", fallback: "Mod+P" },
  { id: "switcher.open", label: "switcher.open", fallback: "Mod+O" },
  { id: "search.open", label: "shell.searchAll", fallback: "Mod+Shift+F" },
  { id: "workspace.closeTab", label: "workspace.closeTab", fallback: "Mod+W" },
  {
    id: "editor.readingMode",
    label: "editor.toggleReading",
    fallback: "Mod+E",
  },
  { id: "editor.sourceMode", label: "editor.toggleSource", fallback: "" },
  { id: "shell.sidebar", label: "shell.toggleLeftPanel", fallback: "Mod+B" },
  {
    id: "shell.rightPanel",
    label: "shell.toggleRightPanel",
    fallback: "Mod+Shift+B",
  },
  { id: "shell.toolbar", label: "shell.toggleToolbar", fallback: "Mod+`" },
  { id: "settings.open", label: "settings.open", fallback: "Mod+," },
] as const satisfies readonly {
  id: string;
  label: MessageKey;
  fallback: Binding;
}[];

export type ShortcutId = (typeof SHORTCUTS)[number]["id"];

/**
 * Keys the app uses in ways the settings do not change: editing, find,
 * zoom, history, tabs, the whole screen. A shortcut may not take them.
 */
const RESERVED: readonly Binding[] = [
  "Mod+A",
  "Mod+C",
  "Mod+V",
  "Mod+X",
  "Mod+S",
  "Mod+Z",
  "Mod+Shift+Z",
  "Mod+Y",
  "Mod+F",
  "Mod+H",
  "Mod+=",
  "Mod+-",
  "Mod+0",
  "Alt+Left",
  "Alt+Right",
  isMac ? "Ctrl+Tab" : "Mod+Tab",
  isMac ? "Ctrl+Shift+Tab" : "Mod+Shift+Tab",
  "F11",
];

/** Whether the app uses `binding` for something the settings do not list. */
export function isReserved(binding: Binding): boolean {
  return RESERVED.includes(binding);
}

/** The shortcuts changed from their defaults; "" for one with no keys. */
type Overrides = Readonly<Partial<Record<ShortcutId, Binding>>>;

const IDS: readonly string[] = SHORTCUTS.map((s) => s.id);

const overridesPreference = preference<Overrides>(
  "carbon.shortcuts",
  {},
  (stored) => {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed !== "object" || parsed === null) return undefined;
      // What a later version stored and this one does not know is left out.
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([id, binding]) => IDS.includes(id) && typeof binding === "string",
        ),
      ) as Overrides;
    } catch {
      return undefined;
    }
  },
  JSON.stringify,
);

function fallbackOf(id: ShortcutId): Binding {
  return SHORTCUTS.find((s) => s.id === id)?.fallback ?? "";
}

function bindingIn(overrides: Overrides, id: ShortcutId): Binding | null {
  const binding = overrides[id] ?? fallbackOf(id);
  return binding === "" ? null : binding;
}

/** The keys of a shortcut now, or `null` if it has none. */
export function bindingFor(id: ShortcutId): Binding | null {
  return bindingIn(overridesPreference.get(), id);
}

/** The keys of a shortcut, kept up to date in a component. */
export function useBinding(id: ShortcutId): Binding | null {
  return bindingIn(overridesPreference.use(), id);
}

/** The keys of a shortcut as the user reads them, such as "Ctrl+B". */
export function useShortcutLabel(id: ShortcutId): string | undefined {
  const binding = useBinding(id);
  return binding === null ? undefined : keys(binding);
}

/** Whether a shortcut has the keys it has by default. */
export function isDefault(id: ShortcutId, binding: Binding | null): boolean {
  return binding === fallbackOf(id);
}

/**
 * Gives a shortcut new keys, or none with `null`. Another shortcut with
 * the same keys keeps them: the settings mark both (`useConflicts`).
 */
export function setBinding(id: ShortcutId, binding: Binding | null): void {
  const next: Partial<Record<ShortcutId, Binding>> = {
    ...overridesPreference.get(),
  };
  if ((binding ?? "") === fallbackOf(id)) delete next[id];
  else next[id] = binding ?? "";
  overridesPreference.set(next);
}

/** The shortcuts that share their keys with another one. */
export function useConflicts(): ReadonlySet<ShortcutId> {
  const overrides = overridesPreference.use();
  const byBinding = new Map<Binding, ShortcutId[]>();
  for (const { id } of SHORTCUTS) {
    const binding = bindingIn(overrides, id);
    if (binding === null) continue;
    byBinding.set(binding, [...(byBinding.get(binding) ?? []), id]);
  }
  return new Set(
    [...byBinding.values()].filter((ids) => ids.length > 1).flat(),
  );
}

/** Gives every shortcut its default keys. */
export function resetAllBindings(): void {
  overridesPreference.set({});
}

/** Whether any shortcut has keys other than its default. */
export function useAnyChanged(): boolean {
  return Object.keys(overridesPreference.use()).length > 0;
}

// While the settings record keys for a shortcut, no shortcut runs.
let recording = false;

/** Whether keys are being recorded for a shortcut. */
export function isRecordingShortcut(): boolean {
  return recording;
}

export function setRecordingShortcut(on: boolean): void {
  recording = on;
}

/** Whether a key press is the shortcut `id`, as the user has set it. */
export function matchesShortcut(event: KeyboardEvent, id: ShortcutId): boolean {
  if (recording) return false;
  const binding = bindingFor(id);
  return binding !== null && bindingOf(event, isMac) === binding;
}
