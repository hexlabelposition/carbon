import type { TextRange } from "@carbon/core";
import fuzzysort from "fuzzysort";
import { useCallback, useEffect, useMemo, useState } from "react";
import { shortcutLetter } from "../workspace/shortcut-letter";
import { useCommandList, type Command } from "./commands";

/** A command the palette shows, with the letters that matched. */
export interface PaletteItem {
  command: Command;
  matches: TextRange[];
}

export interface CommandPalette {
  isOpen: boolean;
  close(): void;
  query: string;
  setQuery(query: string): void;
  /** Every command while nothing is typed, else the ones that match. */
  items: readonly PaletteItem[];
  selected: number;
  select(index: number): void;
  /** Closes the palette, then runs the command. */
  run(command: Command): void;
}

/**
 * The command palette: Ctrl+P (Cmd+P on a Mac) opens it, typing narrows
 * the commands fuzzily by title, as the quick switcher narrows notes.
 */
export function useCommandPalette(): CommandPalette {
  const commands = useCommandList();
  const [isOpen, setOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [selected, select] = useState(0);

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    select(0);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, [setQuery]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = event.ctrlKey || event.metaKey;
      if (!command || event.shiftKey || event.altKey) return;
      if (shortcutLetter(event) !== "p") return;
      setOpen(true);
      // Not the browser's "print", nor the editor's use of the key.
      event.preventDefault();
      event.stopPropagation();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const items = useMemo(() => {
    if (query.trim() === "") {
      return commands.map((command) => ({ command, matches: [] }));
    }
    return fuzzysort
      .go(query, commands, { key: "title", threshold: 0, limit: 0 })
      .map((result) => ({
        command: result.obj,
        matches: rangesOf(result.indexes),
      }));
  }, [commands, query]);

  const run = useCallback(
    (command: Command) => {
      close();
      // After the dialog is gone and has given the focus back: a command
      // that moves the focus, such as "Find in note", keeps it.
      setTimeout(() => command.run(), 0);
    },
    [close],
  );

  return { isOpen, close, query, setQuery, items, selected, select, run };
}

/** Letter offsets as ranges, letters side by side in one. */
function rangesOf(indexes: readonly number[]): TextRange[] {
  const ranges: TextRange[] = [];
  for (const index of [...indexes].sort((a, b) => a - b)) {
    const last = ranges[ranges.length - 1];
    if (last?.end === index) last.end = index + 1;
    else ranges.push({ start: index, end: index + 1 });
  }
  return ranges;
}
