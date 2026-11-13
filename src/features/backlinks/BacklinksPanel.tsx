import type { Backlink, NotePath } from "@carbon/core";
import type { BacklinksState } from "./use-backlinks";

interface BacklinksPanelProps {
  state: BacklinksState;
  /** Opens a note, at the link if `at` is given. */
  onOpen: (path: NotePath, at?: number) => void;
}

/**
 * The notes that link to the shown note, each with the text around every
 * link. A click on the note opens it, a click on a link opens the note at
 * that link.
 */
export function BacklinksPanel({ state, onOpen }: BacklinksPanelProps) {
  if (state.status === "loading") return null;
  if (state.status === "error") {
    return (
      <p className="px-3 py-2 text-small text-danger">
        Backlinks are not available: {state.message}
      </p>
    );
  }

  const groups = bySource(state.backlinks);
  return (
    <div className="py-1">
      {state.partial && (
        <p role="status" className="px-3 pb-1 text-small text-faint">
          Indexing: some backlinks may be missing.
        </p>
      )}
      {groups.length === 0 ? (
        <p className="px-3 py-1 text-small text-faint">No backlinks</p>
      ) : (
        <ul aria-label="Backlinks">
          {groups.map(({ source, title, links }) => (
            <li key={source} className="pb-1">
              <button
                type="button"
                title={source}
                className="block w-full truncate px-3 py-0.5 text-left font-semibold hover:bg-raise"
                onClick={() => onOpen(source)}
              >
                {title}
              </button>
              <ul>
                {links.map((link) => (
                  <li key={link.start}>
                    <button
                      type="button"
                      className="block w-full px-3 py-0.5 pl-5 text-left text-small text-muted hover:bg-raise hover:text-fg"
                      onClick={() => onOpen(source, link.start)}
                    >
                      {link.snippet || "(empty)"}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Group {
  source: NotePath;
  title: string;
  links: Backlink[];
}

/** The backlinks by the note they are in; the core sorts them by note. */
function bySource(backlinks: readonly Backlink[]): Group[] {
  const groups: Group[] = [];
  for (const link of backlinks) {
    const last = groups[groups.length - 1];
    if (last?.source === link.source) last.links.push(link);
    else {
      groups.push({
        source: link.source,
        title: link.sourceTitle,
        links: [link],
      });
    }
  }
  return groups;
}
