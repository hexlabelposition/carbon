import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

/** An action of the app that the command palette offers. */
export interface Command {
  /** Stays the same for the action: the last one registered wins. */
  id: string;
  /** What the palette shows and matches: "Toggle sidebar". */
  title: string;
  /** The keys that do the same, written with `keys`. */
  shortcut?: string;
  run(): void;
}

/**
 * The commands that the mounted features offer now. A feature adds its
 * commands while it is mounted, so the palette offers only what can be
 * done: no editor commands without an open note.
 */
export class CommandRegistry {
  private readonly groups = new Set<readonly Command[]>();
  private readonly listeners = new Set<() => void>();
  private snapshot: readonly Command[] = [];

  /** Adds commands; returns a function that takes them back. */
  add(commands: readonly Command[]): () => void {
    this.groups.add(commands);
    this.changed();
    return () => {
      this.groups.delete(commands);
      this.changed();
    };
  }

  /** Every command, by title; of commands with one id, the latest. */
  list = (): readonly Command[] => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private changed() {
    const byId = new Map<string, Command>();
    for (const group of this.groups) {
      for (const command of group) byId.set(command.id, command);
    }
    this.snapshot = [...byId.values()].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    for (const listener of this.listeners) listener();
  }
}

export const CommandsContext = createContext<CommandRegistry | null>(null);

/**
 * Offers `commands` in the palette while the calling component is
 * mounted. Give the same array while nothing changes (`useMemo`): a new
 * one replaces the old. Without a `CommandsProvider` above, such as in a
 * dev preview, it does nothing.
 */
export function useCommands(commands: readonly Command[]): void {
  const registry = useContext(CommandsContext);
  useEffect(() => registry?.add(commands), [registry, commands]);
}

/** Every command offered now, by title. Needs a `CommandsProvider`. */
export function useCommandList(): readonly Command[] {
  const registry = useContext(CommandsContext);
  if (registry === null) throw new Error("No CommandsProvider above");
  return useSyncExternalStore(registry.subscribe, registry.list);
}

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * Keys as the user reads them: "Mod" is Ctrl, or Cmd on a Mac, so
 * `keys("Mod+Shift+F")` is "Ctrl+Shift+F" on Linux.
 */
export function keys(spec: string): string {
  return spec.replace(/\bMod\b/g, isMac ? "Cmd" : "Ctrl");
}
