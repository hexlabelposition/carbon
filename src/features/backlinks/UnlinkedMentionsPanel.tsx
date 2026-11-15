import type { Mention, NotePath } from "@carbon/core";
import { Highlighted } from "../search/Highlighted";
import type { UnlinkedMentions } from "./use-unlinked-mentions";

interface UnlinkedMentionsPanelProps {
  mentions: UnlinkedMentions;
  open: boolean;
  onToggle: () => void;
  /** Opens a note, at the mention if `at` is given. */
  onOpen: (path: NotePath, at?: number) => void;
}

/**
 * The places where other notes name the shown note without a link, under
 * a heading that opens and closes the list. A click on a mention opens
 * its note there; "Link" turns it into a link.
 */
export function UnlinkedMentionsPanel({
  mentions: { state, link, linkError },
  open,
  onToggle,
  onOpen,
}: UnlinkedMentionsPanelProps) {
  const count = state.status === "ready" ? state.mentions.length : null;
  return (
    <div className="border-t border-line py-1">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-1 px-3 py-0.5 text-left font-semibold hover:bg-raise"
        onClick={onToggle}
      >
        <span aria-hidden className="w-3 text-faint">
          {open ? "▾" : "▸"}
        </span>
        Unlinked mentions
        {count !== null && (
          <span className="font-normal text-small text-faint">{count}</span>
        )}
      </button>
      {open && <MentionList state={state} link={link} onOpen={onOpen} />}
      {open && linkError !== null && (
        <p role="alert" className="px-3 py-1 text-small text-danger">
          Could not link: {linkError}
        </p>
      )}
    </div>
  );
}

function MentionList({
  state,
  link,
  onOpen,
}: Pick<UnlinkedMentions, "state" | "link"> &
  Pick<UnlinkedMentionsPanelProps, "onOpen">) {
  if (state.status === "error") {
    return (
      <p className="px-3 py-1 text-small text-danger">
        Mentions are not available: {state.message}
      </p>
    );
  }
  if (state.status !== "ready") {
    return <p className="px-3 py-1 text-small text-faint">Looking…</p>;
  }
  const groups = bySource(state.mentions);
  if (groups.length === 0) {
    return <p className="px-3 py-1 text-small text-faint">No mentions</p>;
  }
  return (
    <ul aria-label="Unlinked mentions">
      {groups.map(({ source, title, mentions }) => (
        <li key={source} className="pb-1">
          <button
            type="button"
            title={source}
            className="block w-full truncate px-3 py-0.5 text-left hover:bg-raise"
            onClick={() => onOpen(source)}
          >
            {title}
          </button>
          <ul>
            {mentions.map((mention) => (
              <li
                key={mention.start}
                className="flex items-start gap-1 pr-2 hover:bg-raise"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 py-0.5 pl-5 text-left text-small text-muted hover:text-fg"
                  onClick={() => onOpen(source, mention.start)}
                >
                  <Highlighted
                    text={mention.snippet}
                    ranges={[mention.snippetMatch]}
                    className="rounded-xs bg-highlight text-fg"
                  />
                </button>
                <button
                  type="button"
                  title={`Link this mention in ${title}`}
                  className="mt-0.5 shrink-0 rounded-sm px-1.5 text-small text-muted hover:bg-selected hover:text-fg"
                  onClick={() => link(mention)}
                >
                  Link
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

interface Group {
  source: NotePath;
  title: string;
  mentions: Mention[];
}

/** The mentions by the note they are in; the core sorts them by note. */
function bySource(mentions: readonly Mention[]): Group[] {
  const groups: Group[] = [];
  for (const mention of mentions) {
    const last = groups[groups.length - 1];
    if (last?.source === mention.source) last.mentions.push(mention);
    else {
      groups.push({
        source: mention.source,
        title: mention.sourceTitle,
        mentions: [mention],
      });
    }
  }
  return groups;
}
