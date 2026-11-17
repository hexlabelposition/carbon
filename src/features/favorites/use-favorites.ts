import type { Vault } from "@carbon/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommands } from "../commands/commands";
import { useT } from "../i18n/i18n";
import { imageTypeOf } from "../image/image-file";
import { useWorkspace } from "../workspace/workspace";

export interface FavoritesView {
  /** The favorites that exist, in the order they were added; `null` at first. */
  paths: readonly string[] | null;
  has(path: string): boolean;
  /** Adds `path` to the favorites, or takes it off if it is one. */
  toggle(path: string): void;
  remove(path: string): void;
  /** The last thing that went wrong, in words for the user. */
  error: string | null;
  dismiss(): void;
}

/**
 * Only what opens in a tab can be a favorite: a note or an image. A
 * folder is found in the tree.
 */
export function canBeFavorite(path: string): boolean {
  return /\.md$/i.test(path) || imageTypeOf(path) !== null;
}

/**
 * The favorites of the vault (`vault.favorites`), asked for again when
 * they change and when the vault does: one may have come back.
 */
export function useFavorites(vault: Vault): FavoritesView {
  const [paths, setPaths] = useState<readonly string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Raised to ask for the list again. */
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const reload = () => setVersion((v) => v + 1);
    const stops = [
      vault.on("favorites", reload),
      vault.on("tree", reload),
      vault.on("changed", reload),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, [vault]);

  useEffect(() => {
    // An older answer must not replace a newer one.
    let stale = false;
    vault.favorites.list().then(
      (list) => {
        if (!stale) setPaths(list);
      },
      (reason: unknown) => {
        if (!stale) setError(messageOf(reason));
      },
    );
    return () => {
      stale = true;
    };
  }, [vault, version]);

  const set = useMemo(() => new Set(paths), [paths]);
  const run = useCallback((action: () => Promise<void>) => {
    setError(null);
    action().catch((reason: unknown) => setError(messageOf(reason)));
  }, []);

  // The same function while the list stays: the command depends on it.
  const toggle = useCallback(
    (path: string) =>
      run(() =>
        set.has(path)
          ? vault.favorites.remove(path)
          : vault.favorites.add(path),
      ),
    [vault, set, run],
  );

  return {
    paths,
    has: (path) => set.has(path),
    toggle,
    remove: (path) => run(() => vault.favorites.remove(path)),
    error,
    dismiss: () => setError(null),
  };
}

/**
 * The command that adds the open note to the favorites, or takes it off:
 * in the palette while a note or an image is open.
 */
export function useFavoriteCommand(favorites: FavoritesView): void {
  const t = useT();
  const { path } = useWorkspace();
  const { toggle } = favorites;
  const favorite = path !== null && favorites.has(path);
  useCommands(
    useMemo(
      () =>
        path === null || !canBeFavorite(path)
          ? []
          : [
              {
                id: "favorites.toggle",
                title: t(favorite ? "favorites.remove" : "favorites.add"),
                run: () => toggle(path),
              },
            ],
      [t, path, favorite, toggle],
    ),
  );
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
