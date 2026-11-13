import type { Backlink, NotePath, Vault } from "@carbon/core";
import { useEffect, useState } from "react";

export type BacklinksState =
  | { status: "loading" }
  | {
      status: "ready";
      backlinks: readonly Backlink[];
      /** The startup scan is still running: some may be missing. */
      partial: boolean;
    }
  | { status: "error"; message: string };

/**
 * The links in other notes that point to the note at `path`, asked again
 * whenever the index takes in a change.
 */
export function useBacklinks(vault: Vault, path: NotePath): BacklinksState {
  // Kept with the note it is for: an answer for the note shown before is
  // not shown for this one.
  const [answer, setAnswer] = useState<{
    path: NotePath;
    state: BacklinksState;
  } | null>(null);

  useEffect(() => {
    let current = true;
    let asked = 0;
    const setState = (state: BacklinksState) => setAnswer({ path, state });

    const ask = () => {
      // Only the latest answer counts: an older one may come in later.
      const request = ++asked;
      vault.links.backlinks(path).then(
        (backlinks) => {
          if (!current || request !== asked) return;
          const partial = vault.indexStatus.state === "scanning";
          setState({ status: "ready", backlinks, partial });
        },
        (reason: unknown) => {
          if (!current || request !== asked) return;
          const message =
            reason instanceof Error ? reason.message : String(reason);
          setState({ status: "error", message });
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
  }, [vault, path]);

  return answer?.path === path ? answer.state : { status: "loading" };
}
