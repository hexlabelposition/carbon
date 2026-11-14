import type { NotePath, TitleHit, Vault } from "@carbon/core";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "../workspace/workspace";

export interface QuickSwitcher {
  isOpen: boolean;
  close(): void;
  query: string;
  setQuery(query: string): void;
  hits: readonly TitleHit[];
  /**
   * Where a note named as typed would be made, or `null` if one is there
   * already, or nothing is typed.
   */
  newNote: NotePath | null;
  /** The chosen row: a hit, or past the hits, the new note. */
  selected: number;
  select(index: number): void;
  /** Opens a hit, in the active tab or, with `newTab`, in a new one. */
  choose(hit: TitleHit, newTab: boolean): void;
  /** Makes the note `newNote` and opens it. */
  create(newTab: boolean): void;
  /** Why the last `create` failed, until the query changes. */
  error: string | null;
}

/**
 * The quick switcher: Ctrl+O (Cmd+O on a Mac) opens it, typing narrows
 * the notes by title, and a note that is not there can be made.
 */
export function useQuickSwitcher(vault: Vault): QuickSwitcher {
  const [isOpen, setOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [answer, setAnswer] = useState<{
    query: string;
    hits: readonly TitleHit[];
  }>({ query: "", hits: [] });
  const [selected, select] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { open } = useWorkspace();

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
    setError(null);
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
      if (event.key.toLowerCase() !== "o") return;
      setOpen(true);
      // Not the browser's "open file", nor the editor's use of the key.
      event.preventDefault();
      event.stopPropagation();
    }
    // Capture: the shortcut is taken before the focused element sees it.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let current = true;
    vault.search.titles(query).then(
      (hits) => {
        if (current) setAnswer({ query, hits });
      },
      // Without the tree there is nothing to match; creating still works.
      () => {
        if (current) setAnswer({ query, hits: [] });
      },
    );
    return () => {
      current = false;
    };
  }, [vault, isOpen, query]);

  // Until the hits for this query come, nothing is offered: neither the
  // hits of an older one, nor a new note where one may be already.
  const pending = answer.query !== query;
  const hits = pending ? [] : answer.hits;
  const path = newNotePath(query);
  const exists =
    path !== null &&
    hits.some((hit) => hit.path.toLowerCase() === path.toLowerCase());
  const newNote = pending || exists ? null : path;

  const choose = useCallback(
    (hit: TitleHit, newTab: boolean) => {
      open(hit.path, { target: newTab ? "newTab" : "here" });
      close();
    },
    [open, close],
  );

  const create = useCallback(
    (newTab: boolean) => {
      if (newNote === null) return;
      vault.notes.create(newNote).then(
        () => {
          open(newNote, { target: newTab ? "newTab" : "here" });
          close();
        },
        (reason: unknown) =>
          setError(reason instanceof Error ? reason.message : String(reason)),
      );
    },
    [vault, newNote, open, close],
  );

  return {
    isOpen,
    close,
    query,
    setQuery,
    hits,
    newNote,
    selected,
    select,
    choose,
    create,
    error,
  };
}

/**
 * The path of a note named as typed: at the vault root, or in the folders
 * typed before it, as `projects/Idea`. `null` if nothing is typed.
 */
function newNotePath(query: string): NotePath | null {
  const name = query.trim().replace(/^\/+|\/+$/g, "");
  if (name === "") return null;
  return /\.md$/i.test(name) ? name : `${name}.md`;
}
