import type { NotePath, TagNode, Vault } from "@carbon/core";
import { useCallback, useEffect, useState } from "react";

export type TagTreeState =
  | { status: "loading" }
  | {
      status: "ready";
      tags: readonly TagNode[];
      /** The startup scan is still running: some may be missing. */
      partial: boolean;
    }
  | { status: "error"; message: string };

export type TagNotesState =
  | { status: "loading" }
  | { status: "ready"; notes: readonly NotePath[] }
  | { status: "error"; message: string };

export interface TagsView {
  tree: TagTreeState;
  /** Whether the tags nested in `tag` are shown. */
  isExpanded(tag: string): boolean;
  toggle(tag: string): void;
  /** The tag whose notes are listed, or `null`. */
  selected: string | null;
  select(tag: string | null): void;
  /** The notes of `selected`; loading while none is selected. */
  notes: TagNotesState;
}

/**
 * The tags of the vault as a tree, and the notes of the tag picked in it,
 * while `enabled`: asked for only while the tags are shown, and asked
 * again whenever the index takes in a change.
 */
export function useTags(vault: Vault, enabled: boolean): TagsView {
  const [tree, setTree] = useState<TagTreeState>({ status: "loading" });
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  // Kept with the tag it is for: notes of the tag picked before are not
  // shown for this one.
  const [answer, setAnswer] = useState<{
    tag: string;
    state: TagNotesState;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    let asked = 0;
    const ask = () => {
      // Only the latest answer counts: an older one may come in later.
      const request = ++asked;
      const fresh = () => current && request === asked;
      vault.tags.tree().then(
        (tags) => {
          if (!fresh()) return;
          const partial = vault.indexStatus.state === "scanning";
          setTree({ status: "ready", tags, partial });
        },
        (reason: unknown) => {
          if (fresh()) setTree({ status: "error", message: messageOf(reason) });
        },
      );
      if (selected === null) return;
      vault.tags.notes(selected).then(
        (notes) => {
          if (fresh())
            setAnswer({ tag: selected, state: { status: "ready", notes } });
        },
        (reason: unknown) => {
          if (fresh()) {
            setAnswer({
              tag: selected,
              state: { status: "error", message: messageOf(reason) },
            });
          }
        },
      );
    };

    ask();
    const stops = [
      vault.on("index:progress", ask),
      vault.on("index:ready", ask),
      vault.on("index:updated", ask),
    ];
    return () => {
      current = false;
      for (const stop of stops) stop();
    };
  }, [vault, enabled, selected]);

  const isExpanded = useCallback(
    (tag: string) => expanded.has(tag.toLowerCase()),
    [expanded],
  );
  const toggle = useCallback((tag: string) => {
    const key = tag.toLowerCase();
    setExpanded((old) => {
      const next = new Set(old);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  return {
    tree,
    isExpanded,
    toggle,
    selected,
    select: setSelected,
    notes:
      selected !== null && answer?.tag === selected
        ? answer.state
        : { status: "loading" },
  };
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
