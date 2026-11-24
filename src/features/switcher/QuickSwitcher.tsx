import { useEffect, useRef, type KeyboardEvent } from "react";
import { useT } from "../i18n/i18n";
import { Shortcut } from "../commands/Shortcut";
import { Highlighted } from "../search/Highlighted";
import { ScrollArea } from "../ui/ScrollArea";
import { SCROLLBAR_ROOM } from "../ui/scrollbar-room";
import type { QuickSwitcher as Switcher } from "./use-quick-switcher";
import { AppDialog } from "../dialogs/AppDialog";

/**
 * The quick switcher dialog. The arrow keys choose a row, Enter opens it,
 * Ctrl+Enter opens it in a new tab, Shift+Enter makes a note named as
 * typed even when others match. Escape or a click outside closes it.
 */
export function QuickSwitcher({ switcher }: { switcher: Switcher }) {
  const t = useT();
  const list = useRef<HTMLUListElement>(null);
  const { query, setQuery, hits, newNote, selected, select, error } = switcher;
  const rows = hits.length + (newNote === null ? 0 : 1);

  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function activate(index: number, newTab: boolean) {
    if (index < hits.length) switcher.choose(hits[index], newTab);
    else switcher.create(newTab);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const command = event.ctrlKey || event.metaKey;
    if (event.key === "ArrowDown" && rows > 0) select((selected + 1) % rows);
    else if (event.key === "ArrowUp" && rows > 0) {
      select((selected - 1 + rows) % rows);
    } else if (event.key === "Enter" && event.shiftKey)
      switcher.create(command);
    else if (event.key === "Enter" && rows > 0) activate(selected, command);
    else return;
    event.preventDefault();
  }

  const row = (index: number) =>
    `flex w-full items-baseline gap-2 px-3 py-1 text-left ${
      index === selected ? "bg-selected" : "hover:bg-raise"
    }`;

  return (
    <AppDialog
      aria-label={t("switcher.label")}
      onClose={switcher.close}
      className="fixed inset-x-0 top-[15vh] mx-auto w-full max-w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
    >
      <input
        autoFocus
        type="text"
        role="combobox"
        aria-expanded={rows > 0}
        aria-controls="switcher-list"
        aria-activedescendant={
          rows > 0 ? `switcher-row-${selected}` : undefined
        }
        aria-label={t("switcher.placeholder")}
        placeholder={t("switcher.placeholder")}
        spellCheck={false}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        className="h-10 w-full border-b border-line bg-bg px-3 outline-none"
      />
      {error !== null && (
        <p role="alert" className="px-3 py-1.5 text-small text-danger">
          {t("switcher.createFailed", { reason: error })}
        </p>
      )}
      {rows > 0 && (
        // The heading scrolls with the list: the scrollbar runs the whole
        // height below the field, as in the command palette.
        <ScrollArea className="max-h-[50vh]">
          {query.trim() === "" && hits.length > 0 && (
            <p
              className={`px-3 pt-1.5 text-small text-faint ${SCROLLBAR_ROOM}`}
            >
              {t("switcher.recent")}
            </p>
          )}
          <ul
            id="switcher-list"
            ref={list}
            role="listbox"
            aria-label={t("switcher.notes")}
            className={`py-1 ${SCROLLBAR_ROOM}`}
          >
            {hits.map((hit, index) => (
              <li
                key={hit.path}
                id={`switcher-row-${index}`}
                role="option"
                aria-selected={index === selected}
                className={row(index)}
                onMouseMove={() => select(index)}
                onClick={(event) =>
                  activate(index, event.ctrlKey || event.metaKey)
                }
              >
                {/* Found by an alias: the alias, then the note it names. */}
                <span className="min-w-0 flex-1 truncate">
                  <Highlighted
                    text={hit.alias ?? hit.title}
                    ranges={hit.matches}
                    className="bg-transparent font-semibold text-fg"
                  />
                  {hit.alias !== undefined && (
                    <span className="text-faint"> → {hit.title}</span>
                  )}
                </span>
                {/* The folder of the note, "/" for the root, in a box. The
                    title is cut short first; the folder only past half the
                    row. */}
                <span className="max-w-1/2 shrink-0 truncate rounded-sm border border-line-strong bg-panel px-1 text-small text-faint">
                  {folderOf(hit.path)}
                </span>
              </li>
            ))}
            {newNote !== null && (
              <li
                id={`switcher-row-${hits.length}`}
                role="option"
                aria-selected={selected === hits.length}
                className={row(hits.length)}
                onMouseMove={() => select(hits.length)}
                onClick={(event) =>
                  switcher.create(event.ctrlKey || event.metaKey)
                }
              >
                <span className="text-muted">{t("switcher.create")}</span>
                <span className="min-w-0 truncate">{newNote}</span>
                <span className="ml-auto">
                  <Shortcut text="Shift+Enter" />
                </span>
              </li>
            )}
          </ul>
        </ScrollArea>
      )}
    </AppDialog>
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
