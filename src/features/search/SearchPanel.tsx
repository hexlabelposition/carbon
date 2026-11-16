import type { SearchHit } from "@carbon/core";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { useT } from "../i18n/i18n";
import { Highlighted } from "./Highlighted";
import type { Search } from "./use-search";
import { Tooltip } from "../ui/Tooltip";

/** How a match looks in a hit. */
const MATCH = "rounded-xs bg-highlight text-fg";

interface SearchPanelProps {
  search: Search;
  /** Focuses the field each time it changes, as a shortcut asks. */
  focusRequest: number;
}

/**
 * A search field and the notes it finds, the best first, each with the
 * words found highlighted in its title and in a part of its text. A click
 * opens the note at the first match; Ctrl+click, the middle button and
 * Ctrl+Enter open it in a new tab. From the field, Enter opens the best
 * hit, the arrow keys go through the list, Escape clears the field.
 */
export function SearchPanel({ search, focusRequest }: SearchPanelProps) {
  const t = useT();
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const { query, setQuery, results, open } = search;
  const hits = results.status === "ready" ? results.hits : [];

  useEffect(() => {
    if (focusRequest === 0) return;
    field.current?.focus();
    field.current?.select();
  }, [focusRequest]);

  /** The buttons of the hits, in order. */
  const buttons = () => [
    ...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []),
  ];

  function onFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && hits.length > 0) {
      open(hits[0], event.ctrlKey || event.metaKey);
    } else if (event.key === "ArrowDown") buttons()[0]?.focus();
    else if (event.key === "Escape" && query !== "") setQuery("");
    else return;
    event.preventDefault();
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const all = buttons();
    const at = all.indexOf(event.target as HTMLButtonElement);
    if (at === -1) return;
    if (event.key === "ArrowDown") all[at + 1]?.focus();
    else if (event.key === "ArrowUp") {
      if (at === 0) field.current?.focus();
      else all[at - 1].focus();
    } else if (event.key === "Enter") {
      open(hits[at], event.ctrlKey || event.metaKey);
    } else return;
    event.preventDefault();
  }

  function onHitClick(event: MouseEvent, hit: SearchHit) {
    open(hit, event.ctrlKey || event.metaKey);
  }

  function onHitAuxClick(event: MouseEvent, hit: SearchHit) {
    if (event.button !== 1) return;
    event.preventDefault();
    open(hit, true);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-line px-2 py-1.5">
        <Tooltip label={t("search.syntax")} hoverOnly>
          <input
            ref={field}
            type="search"
            aria-label={t("search.placeholder")}
            placeholder={t("search.placeholder")}
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onFieldKeyDown}
            className="h-6 w-full rounded-sm border border-line-strong bg-bg px-1.5 outline-none focus:border-fg"
          />
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        <Status results={results} />
        {hits.length > 0 && (
          <ul
            aria-label={t("search.results")}
            ref={list}
            onKeyDown={onListKeyDown}
          >
            {hits.map((hit) => (
              <li key={hit.path}>
                <Tooltip label={hit.path}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1 text-left outline-none hover:bg-raise focus-visible:bg-selected"
                    onClick={(event) => onHitClick(event, hit)}
                    onAuxClick={(event) => onHitAuxClick(event, hit)}
                  >
                    <span className="block truncate font-semibold">
                      <Highlighted
                        text={hit.title}
                        ranges={hit.titleMatches}
                        className={MATCH}
                      />
                    </span>
                    {hit.snippet !== "" && (
                      <span className="line-clamp-3 text-small text-muted">
                        <Highlighted
                          text={hit.snippet}
                          ranges={hit.snippetMatches}
                          className={MATCH}
                        />
                      </span>
                    )}
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A line about the results, when there is something to say. */
function Status({ results }: { results: Search["results"] }) {
  const t = useT();
  if (results.status === "error") {
    return (
      <p className="px-3 py-1 text-small text-danger">
        {t("search.failed", { reason: results.message })}
      </p>
    );
  }
  if (results.status !== "ready") return null;
  return (
    <>
      {results.partial && (
        <p role="status" className="px-3 pb-1 text-small text-faint">
          {t("search.partial")}
        </p>
      )}
      {results.hits.length === 0 && (
        <p className="px-3 py-1 text-small text-faint">{t("search.empty")}</p>
      )}
    </>
  );
}
