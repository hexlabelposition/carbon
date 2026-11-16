import {
  isTagLabel,
  tagTree,
  type NotePath,
  type TagCount,
  type TagNode,
  type Vault,
} from "@carbon/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n/i18n";

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
  /** The tag whose new name is being typed, or `null`. */
  renaming: string | null;
  startRename(tag: string): void;
  cancelRename(): void;
  /** Renames `tag` to `name` in every note (`Tags.rename`). */
  commitRename(tag: string, name: string): void;
  /** What went wrong with the last rename, until dismissed. */
  renameError: string | null;
  dismissRenameError(): void;
}

/**
 * The tags of the vault as a tree, and the notes of the tag picked in it,
 * while `enabled`: asked for only while the tags are shown, and asked
 * again whenever the index takes in a change.
 */
export function useTags(vault: Vault, enabled: boolean): TagsView {
  const t = useT();
  const [renaming, setRenaming] = useState<string | null>(null);
  /**
   * A rename is writing notes one by one: the index has the old tag in
   * some and the new one in others, so the tree is not asked for until
   * it is done. Then `round` grows and the tree is asked for again.
   */
  const busy = useRef(false);
  const [round, setRound] = useState(0);
  const [renameError, setRenameError] = useState<string | null>(null);
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
      if (busy.current) return;
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
  }, [vault, enabled, selected, round]);

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

  const commitRename = useCallback(
    (tag: string, name: string) => {
      setRenaming(null);
      const next = name.trim().replace(/^#/, "");
      if (next === "" || next === tag) return;
      setRenameError(null);
      busy.current = true;
      // Shown at once, before the notes are written: the tree, the open
      // tags and the picked one already have the new name. The counts
      // are guessed until the index answers.
      if (isTagLabel(next)) {
        const moved = (current: string) => renamedTag(current, tag, next);
        setTree((old) =>
          old.status === "ready"
            ? { ...old, tags: renamedTree(old.tags, tag, next) }
            : old,
        );
        setExpanded((old) => new Set([...old].map(moved)));
        setSelected((current) => (current === null ? null : moved(current)));
        // The notes listed stay until the index answers for the new name.
        setAnswer((old) =>
          old === null ? old : { ...old, tag: moved(old.tag) },
        );
      }
      const done = () => {
        busy.current = false;
        setRound((n) => n + 1);
      };
      vault.tags.rename(tag, next).then(
        ({ failed }) => {
          if (failed.length > 0) {
            setRenameError(
              t("tags.renamePartial", { count: failed.length, tag }),
            );
          }
          done();
        },
        (reason: unknown) => {
          setRenameError(
            t("tags.renameFailed", { tag, reason: messageOf(reason) }),
          );
          done();
        },
      );
    },
    [vault, t],
  );

  const cancelRename = useCallback(() => setRenaming(null), []);
  const dismissRenameError = useCallback(() => setRenameError(null), []);

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
    renaming,
    startRename: setRenaming,
    cancelRename,
    commitRename,
    renameError,
    dismissRenameError,
  };
}

/**
 * `current` with the tag `from` renamed to `to`, if it is that tag or
 * nested in it; else as it is. Case is ignored, as by the index.
 */
function renamedTag(current: string, from: string, to: string): string {
  const key = current.toLowerCase();
  const old = from.toLowerCase();
  if (key !== old && !key.startsWith(`${old}/`)) return current;
  return to + current.slice(from.length);
}

/**
 * The tree as it will be once `from` is renamed to `to`. A tag that two
 * become one gets the larger count, and a tag the new name is nested in
 * is added: guesses, until the index has the real counts.
 */
function renamedTree(
  nodes: readonly TagNode[],
  from: string,
  to: string,
): TagNode[] {
  const counts = new Map<string, TagCount>();
  const add = (tag: string, count: number) => {
    const key = tag.toLowerCase();
    const known = counts.get(key);
    if (known === undefined || known.count < count) {
      counts.set(key, { tag: known?.tag ?? tag, count });
    }
  };
  const walk = (list: readonly TagNode[]) => {
    for (const node of list) {
      const tag = renamedTag(node.tag, from, to);
      // With the tags it is nested in, which a new name may not have.
      const parts = tag.split("/");
      for (let i = 1; i <= parts.length; i++) {
        add(parts.slice(0, i).join("/"), node.count);
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return tagTree([...counts.values()]);
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
