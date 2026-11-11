import type { NotePath, Vault } from "@carbon/core";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppSettings } from "../settings/app-settings";
import { findNode, isWithin, rebase } from "../vault/paths";
import { ActiveNoteContext, type ActiveNote } from "./active-note";

interface ActiveNoteProviderProps {
  vault: Vault;
  /** The note to start with: the one that was open last time. */
  initial: NotePath | null;
  children: ReactNode;
}

/**
 * Keeps track of the open note of one vault and remembers it in the app
 * settings. Mount it with `key={vault.root}`, so each vault starts fresh.
 */
export function ActiveNoteProvider({
  vault,
  initial,
  children,
}: ActiveNoteProviderProps) {
  const { setLastOpenedNote } = useAppSettings();
  // Only the value at mount counts: later it follows what is saved here.
  const [first] = useState(initial);
  const [path, setPath] = useState(first);

  useEffect(() => {
    void setLastOpenedNote(vault.root, path);
  }, [vault, path, setLastOpenedNote]);

  useEffect(() => {
    let cancelled = false;
    // The remembered note may have been deleted while the app was closed.
    if (first !== null) {
      vault.tree().then(
        (tree) => {
          const node = findNode(tree, first);
          if (cancelled || (node && node.kind !== "folder")) return;
          setPath((current) => (current === first ? null : current));
        },
        () => {},
      );
    }
    const off = vault.on("changed", (change) => {
      if (change.kind !== "removed") return;
      setPath((current) =>
        current !== null && isWithin(current, change.path) ? null : current,
      );
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [vault, first]);

  /** How the mounted editor writes its unsaved edits, if there is one. */
  const flusher = useRef<(() => Promise<void>) | null>(null);

  const active = useMemo<ActiveNote>(
    () => ({
      path,
      open: setPath,
      close: () => setPath(null),
      moved: (from, to) =>
        setPath((current) =>
          current !== null && isWithin(current, from)
            ? rebase(current, from, to)
            : current,
        ),
      removed: (removed) =>
        setPath((current) =>
          current !== null && isWithin(current, removed) ? null : current,
        ),
      onFlush: (flush) => {
        flusher.current = flush;
        return () => {
          if (flusher.current === flush) flusher.current = null;
        };
      },
      flush: () => flusher.current?.() ?? Promise.resolve(),
    }),
    [path],
  );

  return <ActiveNoteContext value={active}>{children}</ActiveNoteContext>;
}
