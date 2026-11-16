import type { Mention, NotePath } from "@carbon/core";
import { useT } from "../i18n/i18n";
import { Highlighted } from "../search/Highlighted";
import type { UnlinkedMentions } from "./use-unlinked-mentions";
import { Tooltip } from "../ui/Tooltip";

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
  const t = useT();
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
        {t("mentions.title")}
        {count !== null && (
          <span className="font-normal text-small text-faint">{count}</span>
        )}
      </button>
      {open && <MentionList state={state} link={link} onOpen={onOpen} />}
      {open && linkError !== null && (
        <p role="alert" className="px-3 py-1 text-small text-danger">
          {t("mentions.linkFailed", { reason: linkError })}
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
  const t = useT();
  if (state.status === "error") {
    return (
      <p className="px-3 py-1 text-small text-danger">
        {t("mentions.failed", { reason: state.message })}
      </p>
    );
  }
  if (state.status !== "ready") {
    return (
      <p className="px-3 py-1 text-small text-faint">{t("mentions.looking")}</p>
    );
  }
  const groups = bySource(state.mentions);
  if (groups.length === 0) {
    return (
      <p className="px-3 py-1 text-small text-faint">{t("mentions.empty")}</p>
    );
  }
  return (
    <ul aria-label={t("mentions.title")}>
      {groups.map(({ source, title, mentions }) => (
        <li key={source} className="pb-1">
          <Tooltip label={source}>
            <button
              type="button"
              className="block w-full truncate px-3 py-0.5 text-left hover:bg-raise"
              onClick={() => onOpen(source)}
            >
              {title}
            </button>
          </Tooltip>
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
                <Tooltip label={t("mentions.linkHint", { name: title })}>
                  <button
                    type="button"
                    className="mt-0.5 shrink-0 rounded-sm px-1.5 text-small text-muted hover:bg-selected hover:text-fg"
                    onClick={() => link(mention)}
                  >
                    {t("mentions.link")}
                  </button>
                </Tooltip>
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
