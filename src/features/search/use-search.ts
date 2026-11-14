import type { SearchHit, Vault } from "@carbon/core";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "../workspace/workspace";

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
  /** What the user typed. */
  query: string;
  setQuery(query: string): void;
  results: SearchResults;
  /**
   * Opens the note of a hit at its first match, in the active tab or, with
   * `newTab`, in a new one.
   */
  open(hit: SearchHit, newTab?: boolean): void;
}

/**
 * Typing waits this long before it searches, in milliseconds: one search
 * for a word typed, not one per letter.
 */
const SEARCH_DELAY_MS = 120;

/**
 * Full-text search over the vault, asked again whenever the index takes
 * in a change. While a new query is on its way, the hits of the last one
 * stay, so the list does not flicker with every letter.
 */
export function useSearch(vault: Vault): Search {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ status: "loading" });
  const workspace = useWorkspace();
  const blank = query.trim() === "";

  useEffect(() => {
    if (blank) return;
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
          const message =
            reason instanceof Error ? reason.message : String(reason);
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
  }, [vault, query, blank]);

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
    },
    [vault, foundFor, openNote],
  );

  return {
    query,
    setQuery,
    results: blank ? { status: "idle" } : results,
    open,
  };
}
