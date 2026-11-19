import type { SearchHit, Vault } from "@carbon/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommands } from "../commands/commands";
import { useDialog } from "../dialogs/open-dialog";
import { useT } from "../i18n/i18n";
import { useWorkspace } from "../workspace/workspace";
import { matchesShortcut, useShortcutLabel } from "../shortcuts/shortcuts";
import { errorText } from "../i18n/error-text";

/** The command that opens the search dialog, offered in the toolbar. */
export const OPEN_SEARCH = "search.open";

export type SearchResults =
  /** Nothing typed yet. */
  | { status: "idle" }
  /** The first answer for what is typed has not come yet. */
  | { status: "loading" }
  | {
      status: "ready";
      /** What the hits were found for. */
      query: string;
      hits: readonly SearchHit[];
      /** The startup scan is still running: some may be missing. */
      partial: boolean;
    }
  | { status: "error"; message: string };

export interface Search {
  /** Whether the search dialog is open. */
  isOpen: boolean;
  close(): void;
  /**
   * Grows each time the dialog is opened: the field takes the focus with
   * the last query selected, so typing starts a new one.
   */
  openCount: number;
  /** What the user typed. Kept while the dialog is shut. */
  query: string;
  setQuery(query: string): void;
  results: SearchResults;
  /** The chosen hit, for the arrow keys and Enter. */
  selected: number;
  select(index: number): void;
  /**
   * Opens the note of a hit at its first match, in the active tab or, with
   * `newTab`, in a new one, and closes the dialog.
   */
  open(hit: SearchHit, newTab?: boolean): void;
}

/**
 * Typing waits this long before it searches, in milliseconds: one search
 * for a word typed, not one per letter.
 */
const SEARCH_DELAY_MS = 120;

/**
 * Full-text search over the vault, in a dialog that Ctrl+Shift+F (Cmd+
 * Shift+F on a Mac) opens. Asked again whenever the index takes in a
 * change. While a new query is on its way, the hits of the last one stay,
 * so the list does not flicker with every letter. The query and its hits
 * stay while the dialog is shut: opening it again goes back to them.
 */
export function useSearch(vault: Vault): Search {
  const t = useT();
  const [isOpen, setOpen] = useDialog("search");
  const shortcut = useShortcutLabel(OPEN_SEARCH);
  const [openCount, setOpenCount] = useState(0);
  const [query, setQueryState] = useState("");
  const [selected, select] = useState(0);
  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    select(0);
  }, []);
  const show = useCallback(() => {
    setOpen(true);
    setOpenCount((n) => n + 1);
  }, [setOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useCommands(
    useMemo(
      () => [
        {
          id: OPEN_SEARCH,
          title: t("shell.searchAll"),
          shortcut,
          run: show,
        },
      ],
      [t, show, shortcut],
    ),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, "search.open")) return;
      show();
      // The editor has uses of its own for some keys.
      event.preventDefault();
      event.stopPropagation();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [show]);
  const [results, setResults] = useState<SearchResults>({ status: "loading" });
  const workspace = useWorkspace();
  const blank = query.trim() === "";

  useEffect(() => {
    // Shut, it does not search: opening it again asks afresh.
    if (blank || !isOpen) return;
    let current = true;
    let asked = 0;

    const ask = () => {
      // Only the latest answer counts: an older one may come in later.
      const request = ++asked;
      vault.search.query(query).then(
        (hits) => {
          if (!current || request !== asked) return;
          const partial = vault.indexStatus.state === "scanning";
          setResults({ status: "ready", query, hits, partial });
        },
        (reason: unknown) => {
          if (!current || request !== asked) return;
          const message = errorText(reason);
          setResults({ status: "error", message });
        },
      );
    };

    const timer = setTimeout(ask, SEARCH_DELAY_MS);
    const stops = [
      vault.on("index:progress", ask),
      vault.on("index:ready", ask),
      vault.on("index:updated", ask),
    ];
    return () => {
      current = false;
      clearTimeout(timer);
      for (const stop of stops) stop();
    };
  }, [vault, query, blank, isOpen]);

  const { open: openNote } = workspace;
  const foundFor = results.status === "ready" ? results.query : query;
  const open = useCallback(
    (hit: SearchHit, newTab = false) => {
      const target = newTab ? "newTab" : "here";
      vault.search.locate(hit.path, foundFor).then(
        (at) => openNote(hit.path, { target, at: at ?? undefined }),
        // The note is still worth opening, at the top.
        () => openNote(hit.path, { target }),
      );
      close();
    },
    [vault, foundFor, openNote, close],
  );

  return {
    isOpen,
    close,
    openCount,
    query,
    setQuery,
    results: blank ? { status: "idle" } : results,
    selected,
    select,
    open,
  };
}
