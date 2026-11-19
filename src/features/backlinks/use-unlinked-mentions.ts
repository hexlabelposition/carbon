import type { Mention, NotePath, Vault } from "@carbon/core";
import { useCallback, useEffect, useState } from "react";
import { errorText } from "../i18n/error-text";

export type MentionsState =
  | { status: "off" }
  | { status: "loading" }
  | { status: "ready"; mentions: readonly Mention[] }
  | { status: "error"; message: string };

export interface UnlinkedMentions {
  state: MentionsState;
  /** Turns a mention into a link to the note. */
  link(mention: Mention): void;
  /** Why the last `link` failed, until the next one. */
  linkError: string | null;
}

/**
 * The places where other notes mention the note at `path` without a
 * link, while `enabled`: finding them reads those notes, so they are
 * asked for only while someone looks. Asked again when the index takes
 * in a change, such as a mention that was just linked.
 */
export function useUnlinkedMentions(
  vault: Vault,
  path: NotePath,
  enabled: boolean,
): UnlinkedMentions {
  // Kept with the note it is for, as in `useBacklinks`.
  const [answer, setAnswer] = useState<{
    path: NotePath;
    state: MentionsState;
  } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    let asked = 0;
    const setState = (state: MentionsState) => setAnswer({ path, state });

    const ask = () => {
      // Only the latest answer counts: an older one may come in later.
      const request = ++asked;
      vault.links.unlinked(path).then(
        (mentions) => {
          if (current && request === asked) {
            setState({ status: "ready", mentions });
          }
        },
        (reason: unknown) => {
          if (current && request === asked) {
            setState({ status: "error", message: messageOf(reason) });
          }
        },
      );
    };

    ask();
    // Not on every step of the startup scan: each answer reads notes.
    const stops = [
      vault.on("index:ready", ask),
      vault.on("index:updated", ask),
    ];
    return () => {
      current = false;
      for (const stop of stops) stop();
    };
  }, [vault, path, enabled]);

  const link = useCallback(
    (mention: Mention) => {
      setLinkError(null);
      vault.links
        .linkMention(mention.source, mention, path)
        .catch((reason: unknown) => setLinkError(messageOf(reason)));
    },
    [vault, path],
  );

  const state: MentionsState = !enabled
    ? { status: "off" }
    : answer?.path === path
      ? answer.state
      : { status: "loading" };
  return { state, link, linkError };
}

function messageOf(reason: unknown): string {
  return errorText(reason);
}
