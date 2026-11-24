import type { SearchHit } from "@carbon/core";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { useT } from "../i18n/i18n";
import { ScrollArea } from "../ui/ScrollArea";
import { SCROLLBAR_ROOM } from "../ui/scrollbar-room";
import { Highlighted } from "./Highlighted";
import type { Search } from "./use-search";
import { AppDialog } from "../dialogs/AppDialog";

/** How a match looks in a hit. */
const MATCH = "rounded-xs bg-highlight text-fg";

/**
 * The search dialog, laid out as the quick switcher: a field and below it
 * the notes found, the best first, each with the words found highlighted
 * in its title and in a part of its text, and its folder. The arrow keys
 * choose a hit, Enter opens it at the first match, Ctrl+Enter, Ctrl+click
 * and the middle button in a new tab. Escape or a click outside closes it;
 * the query stays for the next time.
 */
export function SearchDialog({ search }: { search: Search }) {
  const t = useT();
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const { query, setQuery, results, selected, select, open, openCount } =
    search;
  const hits = results.status === "ready" ? results.hits : [];

  // Each time it is opened, the last query is selected: typing replaces
  // it, the arrow keys go back to its hits.
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, [openCount]);

  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = hits.length;
    if (event.key === "ArrowDown" && count > 0) select((selected + 1) % count);
    else if (event.key === "ArrowUp" && count > 0) {
      select((selected - 1 + count) % count);
    } else if (event.key === "Enter" && count > 0) {
      open(hits[Math.min(selected, count - 1)], event.ctrlKey || event.metaKey);
    } else return;
    event.preventDefault();
  }

  return (
    <AppDialog
      aria-label={t("shell.searchAll")}
      onClose={search.close}
      initialFocus={field}
      className="fixed inset-x-0 top-[15vh] mx-auto w-full max-w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
    >
      <input
        ref={field}
        type="text"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls="search-list"
        aria-activedescendant={
          hits.length > 0 ? `search-row-${selected}` : undefined
        }
        aria-label={t("search.placeholder")}
        aria-describedby="search-syntax"
        placeholder={t("search.placeholder")}
        spellCheck={false}
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        className="h-10 w-full border-b border-line bg-bg px-3 outline-none"
      />
      <Status results={results} />
      {hits.length > 0 && (
        <ScrollArea className="max-h-[55vh]">
          <ul
            id="search-list"
            ref={list}
            role="listbox"
            aria-label={t("search.results")}
            className={`py-1 ${SCROLLBAR_ROOM}`}
          >
            {hits.map((hit, index) => (
              <Hit
                key={hit.path}
                hit={hit}
                index={index}
                selected={index === selected}
                onHover={() => select(index)}
                onOpen={(newTab) => open(hit, newTab)}
              />
            ))}
          </ul>
        </ScrollArea>
      )}
      <p
        id="search-syntax"
        className="border-t border-line px-3 py-1.5 text-small text-faint"
      >
        {t("search.syntax")}
      </p>
    </AppDialog>
  );
}

/** A note found: its title and folder, and below a part of its text. */
function Hit({
  hit,
  index,
  selected,
  onHover,
  onOpen,
}: {
  hit: SearchHit;
  index: number;
  selected: boolean;
  onHover: () => void;
  onOpen: (newTab: boolean) => void;
}) {
  return (
    <li
      id={`search-row-${index}`}
      role="option"
      aria-selected={selected}
      className={`cursor-default px-3 py-1.5 ${
        selected ? "bg-selected" : "hover:bg-raise"
      }`}
      onMouseMove={onHover}
      onClick={(event) => onOpen(event.ctrlKey || event.metaKey)}
      onAuxClick={(event) => {
        // The middle button opens the note in a new tab.
        if (event.button !== 1) return;
        event.preventDefault();
        onOpen(true);
      }}
    >
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate font-semibold">
          <Highlighted
            text={hit.title}
            ranges={hit.titleMatches}
            className={MATCH}
          />
        </span>
        {/* As in the quick switcher: "/" for the root, in a box. */}
        <span className="max-w-1/2 shrink-0 truncate rounded-sm border border-line-strong bg-panel px-1 text-small text-faint">
          {folderOf(hit.path)}
        </span>
      </span>
      {hit.snippet !== "" && (
        <span className="mt-0.5 line-clamp-2 text-small text-muted">
          <Highlighted
            text={hit.snippet}
            ranges={hit.snippetMatches}
            className={MATCH}
          />
        </span>
      )}
    </li>
  );
}

/** A line about the results, when there is something to say. */
function Status({ results }: { results: Search["results"] }) {
  const t = useT();
  if (results.status === "error") {
    return (
      <p role="alert" className="px-3 py-1.5 text-small text-danger">
        {t("search.failed", { reason: results.message })}
      </p>
    );
  }
  if (results.status !== "ready") return null;
  return (
    <>
      {results.partial && (
        <p role="status" className="px-3 pt-1.5 text-small text-faint">
          {t("search.partial")}
        </p>
      )}
      {results.hits.length === 0 && (
        <p className="px-3 py-1.5 text-small text-faint">{t("search.empty")}</p>
      )}
    </>
  );
}

/**
 * The folder a note is in, as a path from the vault root: "/projects"
 * for "projects/Carbon.md", "/" for the root.
 */
function folderOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return `/${slash === -1 ? "" : path.slice(0, slash)}`;
}
